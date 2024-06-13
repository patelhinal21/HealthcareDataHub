import express from "express";
import cors from "cors";
import planRouter from "./routes/planRoute.js";
import elasticsearchClient from "./utils/elasticsearchHelper.js";
import channel from "./utils/rabbitmqHelper.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());

// const queue = "insuracePlan";
// const text = {
//   message: "hello",
// };
// await channel.assertQueue(queue, { durable: false });
// channel.sendToQueue(queue, Buffer.from(JSON.stringify(text)));
// console.log(" [x] Sent %s", text);

app.use("/plan", planRouter);

export default app;
