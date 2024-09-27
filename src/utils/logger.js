const winston = require('winston');

const format = winston.format;
const printNice = format.printf(info => {
  const { level, message } = info;
  return `Log Level: ${level} - Log Message: ${message}`;
});

const enumerateErrorFormat = format(info => {
  if (info.message instanceof Error) {
    info.message = Object.assign(
      {
        message: `${info.message.message}\n============\n${info.message.stack}`,
      },
      info.message
    );
  }

  if (info instanceof Error) {
    return Object.assign(
      {
        message: `${info.message}\n============\n${info.stack}`,
      },
      info
    );
  }

  return info;
});

const levels = {
  none: 0, // To disable log outputs when running tests
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

module.exports = winston.createLogger({
  levels,
  format: format.combine(enumerateErrorFormat(), format.json()),
  transports: [
    new winston.transports.Console({
      format: format.combine(format.colorize(), printNice),
      level: process.env.NODE_ENV === 'test' ? 'none' : 'info',
    }),
  ],
});
