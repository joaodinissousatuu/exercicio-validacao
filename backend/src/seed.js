import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { User } from './models/User.js';
import { Meeting } from './models/Meeting.js';

// Utilizador fixo da app (sem login) — o seu _id é o valor a usar no header X-User-Id.
const FIXED_USER = { name: 'Ana Silva', username: 'ana.silva' };

// Outros utilizadores, só para haver quem pesquisar/convidar.
const OTHER_USERS = [
  { name: 'Bruno Costa', username: 'bruno.costa' },
  { name: 'Carla Mendes', username: 'carla.mendes' },
  { name: 'Diogo Ferreira', username: 'diogo.ferreira' },
  { name: 'Elena Rocha', username: 'elena.rocha' },
];

function tomorrowDate() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// upsert por username: correr o seed várias vezes não muda os _id já atribuídos
// (importante porque o utilizador fixo vai ficar codificado no frontend, sem login).
function upsertUser(data) {
  return User.findOneAndUpdate({ username: data.username }, { $set: data }, { upsert: true, new: true });
}

async function seed() {
  await connectDB();

  const fixedUser = await upsertUser(FIXED_USER);
  const [, carla, diogo] = await Promise.all(OTHER_USERS.map(upsertUser));

  // Reuniões são recriadas do zero a cada seed, para a demo partir sempre do mesmo estado.
  await Meeting.deleteMany({});
  const date = tomorrowDate();

  // Reunião já aceite do utilizador fixo (organizador = automaticamente aceite),
  // para o conflito de horários ser demonstrável sem ter de o fabricar manualmente.
  await Meeting.create({
    title: 'Reunião de alinhamento semanal',
    description: 'Ponto de situação semanal da equipa.',
    date,
    startTime: '10:00',
    organizerId: fixedUser._id,
    participants: [{ userId: fixedUser._id, status: 'accepted' }],
  });

  // Convite pendente que SOBREPÕE a reunião aceite acima (10:00-11:00) — organizado
  // por outro utilizador, para o utilizador fixo poder testar o aviso de conflito e
  // o 409 ao tentar aceitar, sem precisar de fabricar o cenário manualmente.
  await Meeting.create({
    title: 'Revisão de proposta com a Carla',
    description: 'Rever a proposta antes de enviar ao cliente.',
    date,
    startTime: '10:30',
    organizerId: carla._id,
    participants: [
      { userId: carla._id, status: 'accepted' },
      { userId: fixedUser._id, status: 'pending' },
    ],
  });

  // Convite pendente SEM sobreposição — para testar também o caminho feliz (aceitar
  // sem conflito).
  await Meeting.create({
    title: 'Brainstorm com o Diogo',
    description: 'Ideias para a próxima sprint.',
    date,
    startTime: '15:00',
    organizerId: diogo._id,
    participants: [
      { userId: diogo._id, status: 'accepted' },
      { userId: fixedUser._id, status: 'pending' },
    ],
  });

  console.log('Seed concluído.');
  console.log(`Utilizador fixo (usar em X-User-Id): ${fixedUser._id} — ${fixedUser.name}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
