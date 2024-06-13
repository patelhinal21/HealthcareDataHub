import { response } from "express";
import {
  getValue,
  postValue,
  deleteValue,
  getAllValues,
  updateNewPlan,
} from "../service/planService.js";
import client from "../utils/redisdb.js";
import etag from "etag";
import channel from "../utils/rabbitmqHelper.js";

//publish to queue
const queue = "insuracePlan";
await channel.assertQueue(queue, { durable: false });

//controller method to get value based on key
export const getPlanValues = async (request, response) => {
  try {
    const keyToSearch = request.params.id;
    console.log("key to search " + keyToSearch);
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(keyToSearch)));
    const valueFound = await getValue(keyToSearch);
    console.log("value in controller " + valueFound);

    if (valueFound == null) throw new Error();

    const etagFromClient = request.get("if-none-match");
    const etagFromServer = etag(JSON.stringify(valueFound));

    // console.log("etag client " + etagFromClient);
    console.log("client etag " + etagFromClient);
    console.log("server etag " + etagFromServer);

    if (etagFromClient === etagFromServer) {
      response.status(304).send();
      console.log("cache response");
    }
    // (valueFound)
    else {
      response.setHeader("ETag", etagFromServer);
      response.status(200);
      response.send(JSON.parse(JSON.stringify(valueFound)));
      // console.log(response.get("ETag"));
    }
  } catch (err) {
    console.log("inside catch");
    console.log(err);
    response.status(404);
    response.send({ errorMessage: "key not found" });
  }
};

//controller method to post value in database
export const postPlanValues = async (request, response) => {
  try {
    const planFromUser = request.body;
    const objectId = request.body.objectId;
    console.log("object id " + objectId);
    console.log("plan " + planFromUser);

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(planFromUser)));
    console.log(" [x] Sent %s", JSON.stringify(planFromUser));

    const planPosted = await postValue(planFromUser, objectId);

    if (planPosted) {
      // const planCreation = await client.SET(
      //   "plan",
      //   JSON.stringify(planFromUser)
      // );
      // response.status(200);
      const etagFromserver = etag(JSON.stringify(planFromUser));
      console.log("post etag " + etagFromserver);
      response.setHeader("ETag", etagFromserver);
      response.status(201);
      response.send({ message: "plan added to key-value store" });
    }

    if (planPosted == null || !planPosted) throw new Error();
  } catch (err) {
    console.log("inside catch post");
    console.log(err);
    response.status(400);
    response.send({ errorMessage: "plan cannot be added to key-value store" });
  }
};
function storeInRedis(data) {
  const client = createRedisClient();
  for (let key in data) {
    if (typeof data[key] === "object") {
      if (data[key].hasOwnProperty("objectId")) {
        client.hSet(
          `${data[key].objectType}:${data[key].objectId}`,
          "field",
          JSON.stringify(data[key]),
          (err, reply) => {
            if (err) console.error(err);
            console.log(
              `Stored object with objectId ${data[key].objectId} in Redis`
            );
          }
        );
      }
      storeInRedis(data[key]); // Recursively call for nested objects
    }
  }
}

//controller method to delete value in in db
export const removePlanValues = async (request, response) => {
  try {
    const keyToRemove = request.params.id;
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(keyToRemove)));
    const numOfKeysDeleted = await deleteValue(keyToRemove);

    if (numOfKeysDeleted > 0) {
      response.status(204);
      response.send({ message: "plan deleted " });
    }

    if (numOfKeysDeleted == 0) throw new Error();
  } catch (err) {
    // console.log(err);
    response.status(404);
    response.send({ errorMessage: "key to be deleted not found" });
  }
};

//controller method to get all keys
export const getAll = async (request, response) => {
  try {
    const planValues = await getAllValues();
    console.log("plan values " + planValues);
    const valueForEachKey = planValues.map(async (key) => {
      const valueFromDb = JSON.parse(
        JSON.stringify(await client.json.get(key))
      );

      console.log("key in array " + key);
      console.log(" value " + JSON.stringify(valueFromDb));
      // return valueFromDb;
      return { [key]: valueFromDb };
    });

    const valueForEachKeyAfterPromise = await Promise.all(valueForEachKey);

    console.log("value for each key " + valueForEachKeyAfterPromise);
    console.log(" first");

    if (planValues) {
      response.status(200);
      response.send({ message: valueForEachKeyAfterPromise });
    }
  } catch (err) {
    response.status(404);
    response.send({ errorMessage: "values not found" });
  }
};

//controller method for patch
export const updateValues = async (request, response) => {
  try {
    const keyToUpdate = request.params.id;
    const planFromUser = request.body;
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(keyToUpdate)));
    const afterRedisPatch = await updateNewPlan(request, keyToUpdate);
    if (afterRedisPatch == null) throw new Error();
    else if (afterRedisPatch == false) {
      response.status(400);
      response.send({
        message: "plan cannot be added to key value store as schema not valid",
      });
    }
    // if isValid is false, cannot be added to key value store
    else if (afterRedisPatch === "not available") {
      response.status(412);
      response.send("etag does not match");
    } else {
      const etagFromServer = etag(JSON.stringify(afterRedisPatch));
      response.setHeader("ETag", etagFromServer); // comments
      response.status(204).send({ message: "update successful" });
    }
  } catch (err) {
    console.log("inside catch block for patch");
    console.log(err);
    response.status(404);
    response.send({ errorMessage: "key to update not found" });
  }
};
