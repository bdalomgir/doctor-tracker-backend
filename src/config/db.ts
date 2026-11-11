import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });

  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
