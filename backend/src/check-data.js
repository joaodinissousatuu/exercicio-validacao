import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { meetingRepository } from './meetings/meetingRepository.js';

// Lista as reuniões gravadas que o modelo atual já não aceita (SPEC.md §21) —
// por exemplo, criadas antes de a data/hora ser validada ou de o organizador ser
// obrigado a estar aceite. Uma só reunião assim faz GET /meetings dar 500 a quem
// nela participa. Só lê: não altera nem apaga nada. Usa a MONGODB_URI do .env.
// Termina com código 1 se encontrar alguma, para poder ser usado em scripts.

async function checkData() {
  await connectDB();
  const invalid = await meetingRepository.findInvalid();

  if (invalid.length === 0) {
    console.log('Nenhuma reunião inválida encontrada.');
  } else {
    console.log(`${invalid.length} reunião(ões) que o modelo atual não aceita:`);
    for (const { _id, title, reason } of invalid) {
      console.log(`- ${_id} "${title}": ${reason}`);
    }
    console.log('Nada foi alterado. Corrige ou apaga estas reuniões na base de dados (por exemplo no MongoDB Atlas).');
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

checkData().catch((err) => {
  console.error(err);
  process.exit(2);
});
