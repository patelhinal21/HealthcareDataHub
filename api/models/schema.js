const Ajv = require("ajv");
const ajv = new Ajv();

ajv.addFormat("custom-date", {
  validate: (dateString) => {
    const regex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
    return regex.test(dateString);
  }
});

const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HealthcarePlan",
  "type": "object",
  "properties": {
    "planCostShares": {
      "type": "object",
      "properties": {
        "deductible": { "type": "integer" },
        "_org": { "type": "string" },
        "copay": { "type": "integer" },
        "objectId": { "type": "string" },
        "objectType": { "type": "string" }
      },
      "required": ["deductible", "_org", "copay", "objectId", "objectType"]
    },
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
              "deductible": { "type": "integer" },
              "_org": { "type": "string" },
              "copay": { "type": "integer" },
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
    "objectId": { "type": "string" },
    "objectType": { "type": "string" },
    "planType": { "type": "string" },
    "creationDate": { "type": "string","format": "custom-date"  }
  },
  "required": ["planCostShares", "linkedPlanServices", "_org", "objectId", "objectType", "planType", "creationDate"],
  "additionalProperties": false
};

const validate = ajv.compile(schema);

module.exports = validate;
