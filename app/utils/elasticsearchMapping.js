import elasticsearchClient from "./elasticsearchHelper.js";

let mapOfDocuments = new Map();
let listOfKeys = [];

export const indexMappingJoins = async () => {
  try {
    let indexElasticsearch = await elasticsearchClient.indices.create({
      index: "indexplan",
      body: {
        mappings: {
          properties: {
            planCostShares: {
              type: "object",
              properties: {
                deductible: { type: "keyword" },
                _org: { type: "keyword" },
                copay: { type: "integer" },
                objectId: { type: "keyword" },
                objectType: { type: "keyword" },
              },
            },
            linkedPlanServices: {
              type: "nested",
              properties: {
                linkedService: {
                  type: "object",
                  properties: {
                    _org: { type: "keyword" },
                    objectId: { type: "keyword" },
                    objectType: { type: "keyword" },
                    name: { type: "text" },
                  },
                },
                planserviceCostShares: {
                  type: "object",
                  properties: {
                    deductible: { type: "integer" },
                    copay: { type: "integer" },
                  },
                },
                _org: { type: "keyword" },
                objectId: { type: "keyword" },
                objectType: { type: "keyword" },
              },
            },
            _org: { type: "keyword" },
            objectId: { type: "keyword" },
            objectType: { type: "keyword" },
            planType: { type: "keyword" },
            creationDate: { type: "keyword" },
            plan_join: {
              type: "join",
              relations: {
                plan: ["planCostShares", "linkedPlanServices"],
                linkedPlanServices: ["linkedService", "planserviceCostShares"],
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.log("error in adding index", error);
  }
};

export async function save(index, plan) {
  try {
    mapOfDocuments = new Map();
    console.log("inside of save 1");
    convertMapToDocumentIndex(plan, "", "plan");

    console.log("map of documents", mapOfDocuments);

    for (let [key, value] of mapOfDocuments.entries()) {
      const keyParts = key.split(":");
      const parentId = keyParts[0];
      const objectId = keyParts[1];
      const indexRequest = {
        index: index,
        id: objectId,
        body: value,
        routing: parentId,
        refresh: "true",
      };

      const { body: indexResponse } = await elasticsearchClient.index(
        indexRequest
      );
    }
  } catch (error) {
    console.error("Failed to post document:", error);
  }
}

function convertMapToDocumentIndex(jsonObject, parentId, objectName) {
  let map = new Map();
  let valueMap = {};

  for (let key of Object.keys(jsonObject)) {
    let redisKey = jsonObject["objectType"] + ":" + parentId;
    let value = jsonObject[key];

    if (value instanceof Object && !Array.isArray(value)) {
      convertMapToDocumentIndex(value, jsonObject["objectId"].toString(), key);
    } else if (Array.isArray(value)) {
      convertToList(value, jsonObject["objectId"].toString(), key);
    } else {
      valueMap[key] = value;
      map.set(redisKey, valueMap);
    }
  }

  let temp = {};
  if (objectName === "plan") {
    valueMap["plan_join"] = objectName;
  } else {
    temp["name"] = objectName;
    temp["parent"] = parentId;
    valueMap["plan_join"] = temp;
  }

  let id = parentId + ":" + jsonObject["objectId"].toString();
  mapOfDocuments.set(id, valueMap);

  return map;
}

function convertToList(array, parentId, objectName) {
  let list = [];
  array.forEach((item) => {
    let value = item;
    if (Array.isArray(value)) {
      value = convertToList(value, parentId, objectName);
    } else if (value instanceof Object && !Array.isArray(value)) {
      value = convertMapToDocumentIndex(value, parentId, objectName);
    }
    list.push(value);
  });
  return list;
}
