import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { seedDemoData } from './seedData.js';

// `npm run seed`: popula a base de dados do .env com os dados de demonstração
// (ver seedData.js) e imprime o id do utilizador fixo, a usar em X-User-Id.

async function seed() {
  await connectDB();
  const fixedUser = await seedDemoData();

  console.log('Seed concluído.');
  console.log(`Utilizador fixo (usar em X-User-Id): ${fixedUser._id} — ${fixedUser.name}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
