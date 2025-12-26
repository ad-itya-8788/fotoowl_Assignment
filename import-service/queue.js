const amqp = require("amqplib");

let channel;

async function connectQueue() {
  const connection = await amqp.connect("amqp://localhost");
  channel = await connection.createChannel();
  await channel.assertQueue("image_jobs");
  console.log("Connected to RabbitMQ");
}

async function sendToQueue(data) {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  channel.sendToQueue(
    "image_jobs",
    Buffer.from(JSON.stringify(data))
  );
}

module.exports = {
  connectQueue,
  sendToQueue,
};
