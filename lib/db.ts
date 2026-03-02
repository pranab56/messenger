import mongoose from 'mongoose';

const MONGODB_URI = (process.env.MONGODB_URI as string) || "";

let cached = (global as unknown as { mongoose: { conn: mongoose.Mongoose | null, promise: Promise<mongoose.Mongoose> | null } }).mongoose;

if (!cached) {
  cached = (global as unknown as { mongoose: { conn: mongoose.Mongoose | null, promise: Promise<mongoose.Mongoose> | null } }).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: 'tradelog_main',
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
