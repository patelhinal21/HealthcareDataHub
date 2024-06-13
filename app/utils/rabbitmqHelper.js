import amqp from "amqplib";

const connection = await amqp.connect("amqp://guest:guest@localhost:5672");
const channel = await connection.createChannel();

export default channel;
