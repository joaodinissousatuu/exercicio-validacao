import { before, after, beforeEach } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { app } from '../../src/app.js';
import { UserModel } from '../../src/users/UserModel.js';
import { MeetingModel } from '../../src/meetings/MeetingModel.js';

/**
 * Infraestrutura comum aos testes de integração: um MongoDB temporário em memória
 * (mongodb-memory-server), a app Express verdadeira a ouvir numa porta livre, e a
 * base de dados limpa antes de cada teste. Nada aqui toca na base de dados do .env.
 *
 * Na primeira execução, o mongodb-memory-server descarrega o binário do MongoDB
 * (~120 MB, para ~/.cache/mongodb-binaries); as seguintes usam a cópia local.
 */
export function useTestServer() {
  const ctx = { mongo: null, server: null, baseUrl: null };

  before(async () => {
    ctx.mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
    await mongoose.connect(ctx.mongo.getUri('buildtoo-test'));
    await new Promise((resolve) => {
      ctx.server = app.listen(0, '127.0.0.1', resolve);
    });
    ctx.baseUrl = `http://127.0.0.1:${ctx.server.address().port}`;
  });

  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), MeetingModel.deleteMany({})]);
  });

  after(async () => {
    await new Promise((resolve) => ctx.server?.close(resolve));
    await mongoose.disconnect();
    await ctx.mongo?.stop();
  });

  return ctx;
}

/**
 * Cliente HTTP mínimo: faz o pedido como o utilizador `asUserId` (header X-User-Id).
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function request(ctx, asUserId, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (asUserId) headers['X-User-Id'] = asUserId;
  const res = await fetch(ctx.baseUrl + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

/** Cria utilizadores diretamente na base de dados; devolve os ids como strings, pela ordem dada. */
export async function createUsers(...usernames) {
  const docs = await UserModel.create(usernames.map((username) => ({ name: username, username })));
  return docs.map((d) => String(d._id));
}

/**
 * Cria uma reunião diretamente na base de dados (sem passar pela API — para montar
 * cenários, como o seed.js). `participants` é { [userId]: status }.
 */
export async function insertMeeting({ title = 'Reunião', date, startTime, organizerId, participants }) {
  const doc = await MeetingModel.create({
    title,
    description: 'Descrição',
    date,
    startTime,
    organizerId,
    participants: Object.entries(participants).map(([userId, status]) => ({ userId, status })),
  });
  return String(doc._id);
}

/** Data `days` dias a partir de hoje, no formato YYYY-MM-DD (hora local, como o backend). */
export function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
