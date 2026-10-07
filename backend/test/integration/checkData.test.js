import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { meetingRepository } from '../../src/meetings/meetingRepository.js';
import { useTestServer, request, createUsers, insertMeeting, daysFromNow } from './helpers.js';

// Reuniões gravadas antes das regras atuais (data/hora validada desde a SPEC §17,
// invariantes do agregado desde a §18) podem já não ser aceites pelo modelo — e uma
// só reunião assim fazia GET /meetings dar 500 a quem nela participa. O repositório
// encontra-as, e `npm run check-data` lista-as sem alterar nada (SPEC §21).

const ctx = useTestServer();
const backendDir = fileURLToPath(new URL('../..', import.meta.url));

let ana;
let carla;
let invalidDate;
let organizerDeclined;

beforeEach(async () => {
  [ana, carla] = await createUsers('ana', 'carla');
  await insertMeeting({ title: 'Válida', date: daysFromNow(2), startTime: '09:00', organizerId: ana, participants: { [ana]: 'accepted' } });
});

async function insertLegacyMeetings() {
  invalidDate = await insertMeeting({ title: 'Data inválida', date: 'amanhã', startTime: '10:00', organizerId: ana, participants: { [ana]: 'accepted' } });
  organizerDeclined = await insertMeeting({
    title: 'Organizador recusou',
    date: daysFromNow(2),
    startTime: '11:00',
    organizerId: ana,
    participants: { [ana]: 'declined', [carla]: 'pending' },
  });
}

function runCheckData() {
  return promisify(execFile)('node', ['src/check-data.js'], {
    cwd: backendDir,
    env: { ...process.env, MONGODB_URI: ctx.mongo.getUri('buildtoo-test') },
  }).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (err) => ({ code: err.code, stdout: err.stdout }),
  );
}

describe('dados antigos que o modelo já não aceita', () => {
  test('sem correção, uma só reunião assim faz GET /meetings dar 500 a quem nela participa', async () => {
    await insertLegacyMeetings();

    assert.equal((await request(ctx, ana, 'GET', '/meetings')).status, 500);
  });

  test('findInvalid() encontra-as e diz porquê; as válidas não aparecem', async () => {
    await insertLegacyMeetings();

    const invalid = await meetingRepository.findInvalid();

    assert.deepEqual(
      invalid.map((m) => [m._id, m.title]),
      [
        [invalidDate, 'Data inválida'],
        [organizerDeclined, 'Organizador recusou'],
      ],
    );
    assert.match(invalid[0].reason, /Data ou hora inválida/);
    assert.match(invalid[1].reason, /organizador/);
  });

  test('npm run check-data lista-as e termina com erro, sem alterar nada', async () => {
    await insertLegacyMeetings();

    const { code, stdout } = await runCheckData();

    assert.equal(code, 1);
    assert.match(stdout, new RegExp(invalidDate));
    assert.match(stdout, new RegExp(organizerDeclined));
    assert.equal((await meetingRepository.findInvalid()).length, 2);
  });

  test('npm run check-data numa base de dados sem problemas termina sem erro', async () => {
    const { code, stdout } = await runCheckData();

    assert.equal(code, 0);
    assert.match(stdout, /Nenhuma reunião inválida/);
  });
});
