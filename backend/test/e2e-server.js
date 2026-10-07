import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { app } from '../src/app.js';
import { seedDemoData } from '../src/seedData.js';
import { UserModel } from '../src/users/UserModel.js';

/**
 * Backend descartável para os testes ponta a ponta do frontend (frontend/e2e/):
 * MongoDB em memória, os dados de demonstração do seed, e a app Express real.
 * Nunca toca na base de dados do .env.
 *
 * - API em http://127.0.0.1:$PORT (por defeito 3100).
 * - POST http://127.0.0.1:$RESET_PORT/reset (por defeito 3101) repõe os dados de
 *   demonstração, para cada teste partir do mesmo estado. Vive numa porta e numa
 *   app à parte de propósito: a app de produção não ganha nenhuma rota de teste.
 * - O utilizador fixo (Ana Silva) tem sempre o id $FIXED_USER_ID, para o frontend o
 *   poder receber em VITE_FIXED_USER_ID antes de o servidor arrancar. O seed faz
 *   upsert por username, por isso mantém o id criado aqui.
 *
 * Uso: npm run e2e:server (arrancado automaticamente pelo playwright.config.js).
 */

const PORT = Number(process.env.PORT ?? 3100);
const RESET_PORT = Number(process.env.RESET_PORT ?? 3101);
const FIXED_USER_ID = process.env.FIXED_USER_ID ?? '650000000000000000000001';

async function resetDemoData() {
  await mongoose.connection.db.dropDatabase();
  await UserModel.create({ _id: FIXED_USER_ID, name: 'Ana Silva', username: 'ana.silva' });
  await seedDemoData();
}

const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
await mongoose.connect(mongo.getUri('buildtoo-e2e'));
await resetDemoData();

const apiServer = app.listen(PORT, '127.0.0.1');

const control = express();
control.post('/reset', async (req, res) => {
  await resetDemoData();
  res.json({ ok: true });
});
const controlServer = control.listen(RESET_PORT, '127.0.0.1');

console.log(`Backend de testes pronto: API em http://127.0.0.1:${PORT}, reset em http://127.0.0.1:${RESET_PORT}/reset`);

async function shutdown() {
  apiServer.close();
  controlServer.close();
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
