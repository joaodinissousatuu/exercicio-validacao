import 'dotenv/config';
import { app } from './app.js';
import { connectDB } from './db.js';

const PORT = process.env.PORT ?? 3000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
  });
}

start();
