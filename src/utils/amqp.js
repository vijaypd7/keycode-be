const amqplib = require('amqplib');
const _ = require('lodash');
const callbackTimeout = require('callback-timeout');
const logger = require('./logger');

const CONSUME_TIMEOUT_MS = 5000;

const amqp = {
  conn: null,
  ch: null,
  queue: null,
  worker: null,

  async init() {
    try {
      this.conn = await amqplib.connect(process.env.RABBIT_URL);
      this.ch = await this.conn.createChannel();

      await this.setupExchangesAndQueues();
      await this.setupBindings();

      this.conn.on('error', this.handleConnectionError.bind(this));
      logger.info(`Connected to ${process.env.RABBIT_URL}`);
    } catch (error) {
      logger.error('Failed to initialize AMQP client', error);
      throw error;
    }
  },

  async setupExchangesAndQueues() {
    const { EXCHANGE_NAME, DEAD_LETTER_EXCHANGE_NAME } = process.env;
    const exchanges = [EXCHANGE_NAME, DEAD_LETTER_EXCHANGE_NAME];
    const queues = ['MessageQueue.ProductSync'];

    await Promise.all([
      ...exchanges.map(ex => this.ch.assertExchange(ex, 'topic', { durable: true })),
      ...queues.map(queue => this.ch.assertQueue(queue, {
        durable: true,
        deadLetterExchange: DEAD_LETTER_EXCHANGE_NAME,
        maxPriority: 255,
      }))
    ]);
  },

  async setupBindings() {
    const queueRoutings = {
      'MessageQueue.ProductSync': ['MessageRoutingKey.ProductSync'],
    };

    for (const [queue, routingKeys] of Object.entries(queueRoutings)) {
      for (const routingKey of routingKeys) {
        await this.ch.bindQueue(queue, process.env.EXCHANGE_NAME, routingKey);
      }
    }
  },

  async handleConnectionError(err) {
    logger.error('AMQP connection error', err);
    try {
      await this.reconnect();
    } catch (reconnectError) {
      logger.error('Failed to reconnect', reconnectError);
      process.exit(1);
    }
  },

  async reconnect(delay = 5000) {
    logger.error(`Connection to ${process.env.RABBIT_URL} closed. Reconnecting...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.init();
      if (this.queue && this.worker) {
        await this.subscribeToQueue(this.queue, this.worker);
      }
    } catch (error) {
      await this.reconnect(delay * 2);
    }
  },

  async getConnection() {
    if (!this.conn) {
      await this.init();
    }
    return this.conn;
  },

  async getChannel() {
    if (!this.ch) {
      const conn = await this.getConnection();
      this.ch = await conn.createChannel();
    }
    return this.ch;
  },

  async publishMessage(routingKey, params, priority = 0) {
    const ch = await this.getChannel();
    const msg = JSON.stringify(params);

    await ch.publish(process.env.EXCHANGE_NAME, routingKey, Buffer.from(msg), {
      priority,
      persistent: true,
    });
  },

  async subscribeToQueue(queue, worker) {
    const ch = await this.getChannel();
    this.queue = queue;
    this.worker = worker;

    logger.info(`Waiting on messages from ${queue}`);
    ch.prefetch(1);

    const consumeOptions = { noAck: false };
    const messageHandler = process.env.SELF_TERMINATING === 'true'
      ? this.createSelfTerminatingHandler(worker, ch)
      : this.createStandardHandler(worker, ch);

    ch.consume(queue, messageHandler, consumeOptions);
  },

  createSelfTerminatingHandler(worker, ch) {
    return callbackTimeout(async (msg) => {
      if (msg.code === 'ETIMEDOUT') {
        await this.closeConnection();
        logger.info('No messages enqueued. Terminating worker.');
        process.exit(0);
      } else {
        await this.processMessage(worker, ch, msg);
        await this.closeConnection();
        logger.info('Finished processing message. Terminating worker.');
        process.exit(0);
      }
    }, CONSUME_TIMEOUT_MS);
  },

  createStandardHandler(worker, ch) {
    return async (msg) => {
      await this.processMessage(worker, ch, msg);
    };
  },

  async processMessage(worker, ch, msg) {
    logger.info('Received message:', JSON.stringify(_.omit(msg, 'content')));
    const { content, properties } = msg;

    try {
      await worker.run(content, properties);
      ch.ack(msg);
      logger.info('Acking message');
    } catch (error) {
      this.handleProcessingError(error, ch, msg);
    }
  },

  handleProcessingError(error, ch, msg) {
    logger.error(`Error processing message: ${error.stack}`);
    ch.nack(msg, false, false); // Don't requeue msg or it will enter an infinite loop
  },

  async closeConnection() {
    if (this.ch) await this.ch.close();
    if (this.conn) await this.conn.close();
  }
};

module.exports = { amqp };