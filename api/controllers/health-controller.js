const validate = require('../models/schema.js');
const schema = require('../models/patch.Schema.js');
const redis = require('redis');
const etag = require('etag');
const Ajv = require('ajv');
const ajv = new Ajv();

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

function flattenAndStore(data, parentId = null) {
  const entries = [];

  function traverse(obj, parentKey = '') {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          // Check if the object has both objectType and objectId
          if (key === 'objectId' && obj.objectType) {
            // Construct the id using objectType and objectId
            const id = `${obj.objectType}:${value}`;
            const entry = JSON.stringify(obj);
            entries.push({ id, entry });
          } else {
            // Traverse further if not the target object
            traverse(value, key);
          }
        }
      }
    }
  }

  traverse(data);
  return entries;
}

const postPlan = async (req, res) => {
  const valid = validate(req.body);
  if (!valid) {
    return res.status(400).json({
      errors: validate.errors
    });
  }
  try {
    const data = req.body;
    const etag = generateETag(JSON.stringify(data));

    // Flatten the JSON and store in Redis
    const entries = flattenAndStore(data);
    entries.forEach(({ id, entry }) => {
      client.set(id, entry, (storeErr) => {
        if (storeErr) {
          console.error(storeErr);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
        console.log(`Stored object with objectId ${id} in Redis`);
      });
    });

    res.setHeader('ETag', etag);
    return res.status(201).json({ message: 'Data stored successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

const patchPlan = async (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  try {
    const clientETag = req.header('If-Match');

    // Retrieve the data using the prefixed key
    const dataString = await new Promise((resolve, reject) => {
      client.get(`plan:${id}`, (err, data) => {  // Assuming the prefix is "plan:" for this example
        if (err) reject(err);
        resolve(data);
      });
    });

    if (!dataString) {
      return res.status(404).json({ message: 'Data not found' });
    }

    const existingData = JSON.parse(dataString);

    // Ensure existingData has an objectType property
    if (!existingData.objectType) {
      return res.status(400).json({ error: 'Existing data does not have an objectType property' });
    }

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

    // Validate the merged data using the updated schema
    const validate = ajv.compile(schema);
    const valid = validate(existingData);
    if (!valid) {
      return res.status(400).json({ errors: validate.errors });
    }

    // Flatten and store the updated data in Redis
    const entries = flattenAndStore(existingData);
    await Promise.all(entries.map(({ id, entry }) => {
      return new Promise((resolve, reject) => {
        client.set(id, entry, (err) => {
          if (err) reject(err);
          resolve();
        });
      });
    }));

    const updatedDataString = JSON.stringify(existingData);
    const newETag = generateETag(updatedDataString);
    res.setHeader('ETag', newETag);
    res.status(200).json(existingData);
  } catch (error) {
    console.error('Error applying patch:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const deletePlan = async (req, res) => {
};
module.exports = { verifyToken, getAllPlans, getPlanById, postPlan, deletePlan, patchPlan };


