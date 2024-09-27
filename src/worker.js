const { EventEmitter } = require("events");
const { ArgumentParser } = require("argparse");
const { amqp } = require("./utils/amqp");
const logger = require("./utils/logger");

const parser = new ArgumentParser({
  description: "Visual Worker",
});
parser.addArgument(["-t", "--type"], {
  help: 'Worker type. ["productsync"]',
});
const args = parser.parseArgs();

const worker = new EventEmitter();
worker.on("ready", async () => {
  const { type } = args;

  try {
    switch (type) {
      case "feedVariationGenerationWorker": {
        break;
      }
      default:
        throw new Error(`Worker type ${type} is invalid`);
    }
  } catch (err) {
    logger.error(err);
    logger.error(`Worker.ready ${err}`);
    process.exit(1);
  }
});

Promise.all([amqp.init()])
  .then(() => {
    logger.info(
      `Connected to mysql://${process.env.DB_HOST}:${process.env.DB_PORT}`
    );
    worker.emit("ready");
  })
  .catch((err) => {
    logger.error(`Worker.init ${err}`);
    logger.error(err);
    process.exit(1);
  });
