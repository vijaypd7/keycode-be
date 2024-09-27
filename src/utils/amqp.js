const amqplib = require('amqplib');
const logger = require('./logger'); // Assuming a logger is available

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';
const EXCHANGE_NAME = process.env.EXCHANGE_NAME || 'my_exchange';
const QUEUE_NAME = process.env.STORY_BUILDER_QUEUE_NAME;
const ROUTING_KEY = process.env.STORY_BUILDER_ROUTING_KEY;

const amqp = {
  conn: null,
  ch: null,

  // Initialize connection to RabbitMQ and create channel
  async init() {
    try {
      this.conn = await amqplib.connect(RABBIT_URL);
      this.ch = await this.conn.createChannel();

      // Assert the exchange and queue
      await this.setupExchangesAndQueues();
      await this.setupBindings();

      logger.info(`Connected to RabbitMQ at ${RABBIT_URL}`);
    } catch (error) {
      logger.error('Failed to initialize AMQP client', error);
      throw error;
    }
  },

  // Setup the exchange and queue
  async setupExchangesAndQueues() {
    await this.ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await this.ch.assertQueue(QUEUE_NAME, { durable: true });
  },

  // Bind the queue to the exchange with a routing key
  async setupBindings() {
    await this.ch.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);
  },

  // Publish a message to the exchange with a specific routing key
  async publishMessage(routingKey, message, priority = 0) {
    const msgBuffer = Buffer.from(JSON.stringify(message));
    await this.ch.publish(EXCHANGE_NAME, routingKey, msgBuffer, {
      persistent: true,
      priority: priority
    });
    logger.info(`Message published to ${routingKey}: ${message}`);
  },

  // Subscribe to a queue and process messages
  async subscribeToQueue(queue, messageHandler) {
    this.ch.prefetch(1);  // Process one message at a time
    await this.ch.consume(queue, async (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        try {
          await messageHandler(content); // Process the message
          this.ch.ack(msg);  // Acknowledge message on success
        } catch (error) {
          logger.error('Error processing message:', error);
          this.ch.nack(msg, false, false);  // Don't requeue message
        }
      }
    }, { noAck: false });
  },

  // Close the RabbitMQ connection and channel
  async closeConnection() {
    if (this.ch) await this.ch.close();
    if (this.conn) await this.conn.close();
    logger.info('AMQP connection closed.');
  }
};

module.exports = { amqp };
