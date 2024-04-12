const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;
const etag = require('etag');
const redis = require('redis');
const { promisify } = require('util');
const Ajv = require('ajv');
const addFormats = require("ajv-formats");
const schema = require('./schema/schema.json')
const patchschema = require('./schema/patchschema.json')

const redisClient = redis.createClient({
    url: 'redis://127.0.0.1:6379'
});

redisClient.connect();

app.use(express.json());

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();
async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Authorization header missing or invalid');
        }

        const token = authHeader.split(' ')[1];
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: '1054491250355-4fjsqd2lqv8ddvrctfd360b1m6dr5d5n.apps.googleusercontent.com',
        });
        const payload = ticket.getPayload();
        req.user = payload;
        next();
    } catch (error) {
        res.status(401).send({ message: 'Unauthorized' });
    }
}


const setAsync = promisify(redisClient.set).bind(redisClient);
const getAsync = promisify(redisClient.get).bind(redisClient);

// Define Ajv instance and compile schema
const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(schema);

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
  

app.post('/v1/plan', async (req, res) => {
    try {
        const { body } = req;

        // Validate request body against schema
        const valid = validate(body);

        if (!valid) {
            return res.status(400).json({ message: 'Validation failed', errors: validate.errors });
        }

        // Flatten the JSON and store in Redis
        const entries = flattenAndStore(body);

        if (entries.length === 0) {
            return res.status(400).json({ message: 'No objects found in the request body.' });
        }

        // Use Redis pipeline to store entries
        const pipeline = redisClient.multi();
        entries.forEach(({ id, entry }) => {
            pipeline.set(id, entry);
        });
        await pipeline.exec();

        // Prepare response with stored objects' details
        const responseBody = entries.map(({ id, entry }) => {
            return { objectId: id, ...JSON.parse(entry) };
        });

        // Calculate ETag for response and send
        const responseEtag = etag(JSON.stringify(req.body));
        res.set('ETag', responseEtag);
        res.status(201).json({ message: 'Data Entered Successfully' });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



app.get('/v1/plan/:id', verifyToken, async (req, res) => {
    const objectId = req.params.id;

    try {
        // Attempt to retrieve data by iterating over possible object types
        const possibleObjectTypes = ['service', 'membercostshare', 'planservice', 'plan']; // Add all possible object types
        let dataString = null;

        // Try to fetch data for each possible object type
        for (const objectType of possibleObjectTypes) {
            const key = `${objectType}:${objectId}`;
            dataString = await redisClient.get(key);
            if (dataString) {
                break; // Stop if data is found for the current object type
            }
        }

        if (dataString) {
            const generatedEtag = etag(dataString);
            const clientEtag = req.headers['if-none-match'];

            if (clientEtag === generatedEtag) {
                res.status(304).end();
            } else {
                res.set('ETag', generatedEtag);
                res.status(200).json(JSON.parse(dataString));
            }
        } else {
            res.status(404).send({ message: 'Data not found' });
        }
    } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});



async function recursiveDelete(objectId, flattenedObject) {
    const keysToDelete = [];

    function traverse(obj, parentKey = '') {
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const value = obj[key];
                    const currentKey = parentKey ? `${parentKey}.${key}` : key;

                    if (key === 'objectId' && obj.objectType) {
                        // Construct the key using objectType and objectId
                        const objectType = obj.objectType;
                        const id = `${objectType}:${value}`;
                        keysToDelete.push(id);
                    } else {
                        // Recursively traverse nested objects
                        traverse(value, currentKey);
                    }
                }
            }
        }
    }

    // Start traversal from the flattenedObject
    traverse(flattenedObject);

    // Use Redis pipeline to delete all related keys
    const pipeline = redisClient.multi();
    keysToDelete.forEach(key => {
        pipeline.del(key);
    });

    // Execute the pipeline and await the result
    const deletionResult = await pipeline.exec();

    // Recursively delete for nested objects (if needed)
    // Example: You may need additional logic here to handle nested deletions

    return deletionResult;
}

app.delete('/v1/plan/:id', verifyToken, async (req, res) => {
    const objectId = req.params.id;

    try {
        // Retrieve and flatten the main object (e.g., plan:objectId) from Redis
        const mainObjectKey = `plan:${objectId}`;
        const mainObjectString = await redisClient.get(mainObjectKey);

        if (!mainObjectString) {
            // If main object not found, return 404 Not Found
            return res.status(404).json({ message: 'Object not found' });
        }

        const mainObject = JSON.parse(mainObjectString);

        // Perform recursive deletion based on the flattened main object structure
        const deletionResult = await recursiveDelete(objectId, mainObject);

        // Log deletionResult for debugging
        console.log('Deletion Result:', deletionResult);

        // Count the number of successful deletions (where result === 1)
        const keysDeleted = deletionResult.filter(result => result === 1).length;

        if (keysDeleted > 0) {
            // If keys were deleted successfully, return 204 No Content
            return res.status(204).end();
        } else {
            // If no keys were deleted, return 404 Not Found
            return res.status(404).json({ message: 'No related entries to delete' });
        }
    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.patch('/v1/plan/:id', verifyToken, async (req, res) => {
    const ajv = new Ajv();
    addFormats(ajv);
    const objectId = req.params.id;
    const patchData = req.body;

    const validatePatch = ajv.compile(patchschema);
    const validPatch = validatePatch(patchData);

    if (!validPatch) {
        return res.status(400).send({ message: "Patch validation failed", errors: validatePatch.errors });
    }

    try {
        const dataString = await redisClient.get(objectId);
        if (dataString) {
            const planData = JSON.parse(dataString);

            // Apply the patch to the existing data
            if (patchData.linkedPlanServices) {
                planData.linkedPlanServices = [...planData.linkedPlanServices, ...patchData.linkedPlanServices];
            }

            // Update the data in Redis
            await redisClient.set(objectId, JSON.stringify(planData));

            // Generate and send ETag
            const generatedEtag = etag(JSON.stringify(planData));
            res.set('ETag', generatedEtag);

            res.status(200).json(planData);
        } else {
            res.status(404).send({ message: 'Data not found' });
        }
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});



app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});