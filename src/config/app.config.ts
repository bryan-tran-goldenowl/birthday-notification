export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27018/birthday_notification',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  webhook: {
    url: process.env.WEBHOOK_URL || 'http://localhost:3000/test-webhook',
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
  },
  scheduler: {
    birthdayCheckHour: parseInt(process.env.BIRTHDAY_CHECK_HOUR || '9', 10),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
    retryDelayBase: parseInt(process.env.RETRY_DELAY_BASE || '60000', 10),
    timezoneBatchSize: parseInt(process.env.TIMEZONE_BATCH_SIZE || '5', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
