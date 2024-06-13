// import { createClient } from "redis";

// const client = createClient();
// client.on("error", (err) => console.log("Redis Client Error", err));

// await client.connect();

// export default client;
// // import Redis from 'ioredis-rejson';
 
// // const client = new Redis({
// //   host: 'localhost',
// //   port: 16379,
// // });
// // // await client.connect();
 
// // export default client;

import { createClient } from "redis";
import dotenv from "dotenv";
 
dotenv.config();
 
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = process.env.REDIS_PORT || 6379;
 
console.log("redis host " + redisHost);
console.log("redis port " + redisPort);
// Construct the Redis connection URL
const redisUrl = `redis://${redisHost}:${redisPort}`;
 
console.log("url " + redisUrl);
 
const client = createClient({ url: redisUrl });
 
client.on("error", (err) => console.log("Redis Client Error", err));
 
await client.connect();
 
export default client;