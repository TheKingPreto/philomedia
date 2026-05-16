import mongoose from 'mongoose';

/** Driver-level tuning; Mongoose 8 relies on the MongoDB Node driver for reconnect behaviour. */
export const MONGO_CONNECTION_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  connectTimeoutMS: 10_000,
};

export function registerMongoConnectionLogging() {
  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Connected');
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected — driver will retry when operations resume');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Reconnected');
  });
  mongoose.connection.on('error', err => {
    console.error('[MongoDB] Connection error:', err.message);
  });
}

/**
 * @param {string} uri
 * @param {import('mongoose').ConnectOptions} [extraOptions]
 */
export async function connectMongo(uri, extraOptions = {}) {
  if (!uri) {
    throw new Error('MONGODB_URI is required to connect.');
  }

  await mongoose.connect(uri, {
    ...MONGO_CONNECTION_OPTIONS,
    ...extraOptions,
  });
}
