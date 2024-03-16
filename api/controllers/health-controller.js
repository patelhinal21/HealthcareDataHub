const validate = require('../models/schema.js');
const express = require('express');
const redis = require('redis');
const etag = require('etag');
const dotenv = require('dotenv');


const { OAuth2Client } = require('google-auth-library');

const client = redis.createClient();


client.on('connect', () => console.log('::> Redis Client Connected'));
client.on('error', (err) => console.log('<:: Redis Client Error', err));

const googleClient = new OAuth2Client();



async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).send({ message: 'Unauthorized' });
  }
}


function generateETag(data) {
  if (typeof data !== 'string') {
    data = JSON.stringify(data);
  }

  return etag(data);
}

const getPlanById = async (req, res) => {
  try {
    const clientEtag = req.header('If-None-Match');
    client.get(req.params.id, (error, data) => {
      if (error) return res.status(500).json({ error: 'Internal Server Error' });
      if (!data) return res.status(404).json({ error: 'Data not found' });

      const retrievedEtag = generateETag(data);
      if (clientEtag && clientEtag === retrievedEtag) {
        res.status(304).json({ message: 'Data not modified' });
      } else {
        res.setHeader('ETag', retrievedEtag);
        res.status(200).json(JSON.parse(data));
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const getAllPlans = async (req, res) => {
  try {
    console.log("inside getAllPlans");
    client.keys('*', (error, keys) => {
      if (error) return res.status(500).json({ error: 'Internal Server Error' });
      if (keys.length === 0) return res.status(404).json({ message: 'No plans found' });
      console.log(keys);

      client.mget(keys, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching plans' });
        const plans = data.map(plan => JSON.parse(plan));
        res.status(200).json(plans);
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const storeData = async (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    return res.status(400).json({
      errors: validate.errors
    });
  }
  try {
    const data = req.body;
    const etag = generateETag(JSON.stringify(data));
    const dataString = JSON.stringify(data);
    client.set(data.objectId, dataString, (storeErr) => {
      if (storeErr) {
        console.error(storeErr);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.setHeader('ETag', etag);
      return res.status(201).json({ message: 'Data stored successfully' });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

const deleteStore = async (req, res) => {
  try {
    const id = req.params.id;

    const deleteResult = await new Promise((resolve, reject) => {
      client.del(id, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });


    if (deleteResult === 0) {
      return res.status(404).json({ message: "Data not found" });
    }


    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updatePlan = async (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    return res.status(400).json({ errors: validate.errors });
  }

  const id = req.params.id;
  const newData = req.body;
  const newDataString = JSON.stringify(newData);

  try {
    const dataExists = await new Promise((resolve, reject) => {
      client.exists(id, (err, exists) => {
        if (err) reject(err);
        resolve(exists);
      });
    });

    if (dataExists) {
      await new Promise((resolve, reject) => {
        client.set(id, newDataString, (err) => {
          if (err) reject(err);
          resolve();
        });
      });

      const newETag = generateETag(newDataString);
      res.setHeader('ETag', newETag);
      res.status(200).json({ message: 'Data updated successfully' });
    } else {
      res.status(404).json({ message: 'Data not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const patchPlan = async (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  try {
    const clientETag = req.header('If-Match');
    const dataString = await new Promise((resolve, reject) => {
      client.get(id, (err, data) => {
        if (err) reject(err);
        resolve(data);
      });
    });

    if (!dataString) {
      return res.status(404).json({ message: 'Data not found' });
    }

    const existingData = JSON.parse(dataString);
    const existingETag = generateETag(dataString);

    if (clientETag !== existingETag) {
      return res.status(412).json({ message: 'Precondition Failed: ETag does not match' });
    }

    // Merge the updates into existingData
    if (updates.linkedPlanServices) {
      existingData.linkedPlanServices = [
        ...existingData.linkedPlanServices,
        ...updates.linkedPlanServices
      ];
    }

    const valid = validate(existingData);
    if (!valid) {
      return res.status(400).json({ errors: validate.errors });
    }

    const updatedDataString = JSON.stringify(existingData);
    await new Promise((resolve, reject) => {
      client.set(id, updatedDataString, (err) => {
        if (err) reject(err);
        resolve();
      });
    });

    const newETag = generateETag(updatedDataString);
    res.setHeader('ETag', newETag);
    res.status(200).json(existingData);
  } catch (error) {
    console.error('Error applying patch:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



module.exports = { verifyToken, getAllPlans, getPlanById, storeData, deleteStore, updatePlan, patchPlan};


