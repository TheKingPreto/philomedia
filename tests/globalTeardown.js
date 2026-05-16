import mongoose from 'mongoose';

/**
 * Ensures MongoDB driver connections are closed so Jest can exit without --forceExit.
 */
export default async function globalTeardown() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
