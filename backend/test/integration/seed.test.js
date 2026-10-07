import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { useTestServer, request } from './helpers.js';

// O README manda correr `npm run seed` e usar o id que ele imprime em X-User-Id.
// Este teste faz exatamente isso, contra o MongoDB temporário, e confirma que o
// cenário de demonstração (um conflito e um convite livre) fica pronto a usar.

const ctx = useTestServer();
const backendDir = fileURLToPath(new URL('../..', import.meta.url));

test('npm run seed: imprime o utilizador fixo e deixa o cenário de demonstração pronto', async () => {
  const { stdout } = await promisify(execFile)('node', ['src/seed.js'], {
    cwd: backendDir,
    env: { ...process.env, MONGODB_URI: ctx.mongo.getUri('buildtoo-test') },
  });
  const fixedUserId = stdout.match(/X-User-Id\): ([0-9a-f]{24})/)?.[1];
  assert.ok(fixedUserId, `o seed não imprimiu o id do utilizador fixo:\n${stdout}`);

  const { status, body } = await request(ctx, fixedUserId, 'GET', '/meetings');

  assert.equal(status, 200);
  assert.deepEqual(
    body.map((m) => [m.startTime, m.myInviteStatus, m.hasConflict]),
    [
      ['10:00', 'accepted', false],
      ['10:30', 'pending', true],
      ['15:00', 'pending', false],
    ],
  );
});
