const validate = require('../models/schema.js');
const express = require('express');
const redis = require('redis');
const crypto = require('crypto');
const etag = require('etag');

const client = redis.createClient();

client.on('connect', () => console.log('::> Redis Client Connected'));
client.on('error', (err) => console.log('<:: Redis Client Error', err));

function generateETag(data) {

      if (typeof data !== 'string') {
         data = JSON.stringify(data);
      }
    
      const hash = crypto.createHash('md5').update(data).digest('hex');
    
      return `"${hash}"`; 
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
    

module.exports = {  getAllPlans, getPlanById, storeData, deleteStore };


