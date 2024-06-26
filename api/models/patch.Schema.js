const Ajv = require('ajv');
const ajv = new Ajv();

const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "linkedPlanServices": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "linkedService": {
            "type": "object",
            "properties": {
              "_org": { "type": "string" },
              "objectId": { "type": "string" },
              "objectType": { "type": "string" },
              "name": { "type": "string" }
            },
            "required": ["_org", "objectId", "objectType", "name"]
          },
          "planserviceCostShares": {
            "type": "object",
            "properties": {
              "deductible": { "type": "number" },
              "_org": { "type": "string" },
              "copay": { "type": "number" },
              "objectId": { "type": "string" },
              "objectType": { "type": "string" }
            },
            "required": ["deductible", "_org", "copay", "objectId", "objectType"]
          },
          "_org": { "type": "string" },
          "objectId": { "type": "string" },
          "objectType": { "type": "string" }
        },
        "required": ["linkedService", "planserviceCostShares", "_org", "objectId", "objectType"]
      }
    },
    "_org": { "type": "string" },
    "objectId": { "type": "string" }
  },
  "required": ["linkedPlanServices", "_org", "objectId"]
};

module.exports = schema;