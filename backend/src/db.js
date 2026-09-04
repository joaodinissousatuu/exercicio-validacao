import mongoose from 'mongoose';
import 'dotenv/config';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Variável de ambiente MONGODB_URI em falta (define-a no ficheiro .env).');
  }
  await mongoose.connect(uri);
  console.log('MongoDB ligado.');
}
