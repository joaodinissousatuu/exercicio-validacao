import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MeetingModel } from '../../src/meetings/MeetingModel.js';
import { useTestServer, request, createUsers, insertMeeting, daysFromNow } from './helpers.js';

// Testes de integração da API de reuniões: app Express verdadeira, MongoDB verdadeiro
// (em memória), sem mocks. Cobrem o que os testes unitários não conseguem: as queries
// do Mongoose, a tradução documento ↔ agregado, e a tradução de erros para HTTP.

const ctx = useTestServer();
const DAY = daysFromNow(2);

let ana;
let carla;
let diogo;
let elena;
const as = (user) => ({
  get: (path) => request(ctx, user, 'GET', path),
  post: (path, body) => request(ctx, user, 'POST', path, body),
  patch: (path, body) => request(ctx, user, 'PATCH', path, body),
});

beforeEach(async () => {
  [ana, carla, diogo, elena] = await createUsers('ana', 'carla', 'diogo', 'elena');
});

function newMeeting(overrides = {}) {
  return { title: 'Nova', description: 'Descrição', date: DAY, startTime: '09:00', participantIds: [], ...overrides };
}

describe('GET /meetings', () => {
  test('lista as minhas reuniões, com o estado do meu convite e o aviso de conflito', async () => {
    await insertMeeting({ title: 'Aceite', date: DAY, startTime: '10:00', organizerId: ana, participants: { [ana]: 'accepted' } });
    await insertMeeting({
      title: 'Sobrepõe',
      date: DAY,
      startTime: '10:30',
      organizerId: carla,
      participants: { [carla]: 'accepted', [ana]: 'pending' },
    });
    await insertMeeting({
      title: 'Livre',
      date: DAY,
      startTime: '15:00',
      organizerId: diogo,
      participants: { [diogo]: 'accepted', [ana]: 'pending' },
    });
    await insertMeeting({ title: 'De outros', date: DAY, startTime: '12:00', organizerId: elena, participants: { [elena]: 'accepted' } });

    const { status, body } = await as(ana).get('/meetings');

    assert.equal(status, 200);
    assert.deepEqual(
      body.map((m) => [m.title, m.myInviteStatus, m.hasConflict]),
      [
        ['Aceite', 'accepted', false],
        ['Sobrepõe', 'pending', true],
        ['Livre', 'pending', false],
      ],
    );
  });

  test('convites pendentes ou recusados não contam para a agenda (não geram conflito)', async () => {
    await insertMeeting({ date: DAY, startTime: '10:00', organizerId: carla, participants: { [carla]: 'accepted', [ana]: 'declined' } });
    await insertMeeting({ date: DAY, startTime: '10:15', organizerId: diogo, participants: { [diogo]: 'accepted', [ana]: 'pending' } });
    await insertMeeting({ date: DAY, startTime: '10:30', organizerId: elena, participants: { [elena]: 'accepted', [ana]: 'pending' } });

    const { body } = await as(ana).get('/meetings');

    assert.deepEqual(
      body.map((m) => m.hasConflict),
      [false, false, false],
    );
  });
});

describe('POST /meetings', () => {
  test('cria a reunião com o organizador aceite e os convidados pendentes, e grava-a', async () => {
    const { status, body } = await as(ana).post('/meetings', newMeeting({ participantIds: [carla, diogo] }));

    assert.equal(status, 201);
    const stored = await MeetingModel.findById(body._id).lean();
    assert.deepEqual(
      stored.participants.map((p) => [String(p.userId), p.status]),
      [
        [ana, 'accepted'],
        [carla, 'pending'],
        [diogo, 'pending'],
      ],
    );
  });

  test('ignora convites repetidos, o próprio organizador e ids com formato inválido', async () => {
    const { status, body } = await as(ana).post('/meetings', newMeeting({ participantIds: [carla, carla, ana, 'lixo'] }));

    assert.equal(status, 201);
    assert.deepEqual(
      body.participants.map((p) => p.userId),
      [ana, carla],
    );
  });

  test('409 se não couber na agenda do organizador, e nada é gravado', async () => {
    await insertMeeting({ date: DAY, startTime: '08:30', organizerId: ana, participants: { [ana]: 'accepted' } });

    const { status, body } = await as(ana).post('/meetings', newMeeting({ startTime: '09:00' }));

    assert.equal(status, 409);
    assert.equal(body.error, 'Conflito de horário com outra reunião já aceite.');
    assert.equal(await MeetingModel.countDocuments(), 1);
  });

  test('logo a seguir a outra reunião (no limite exato) não é conflito', async () => {
    await insertMeeting({ date: DAY, startTime: '08:00', organizerId: ana, participants: { [ana]: 'accepted' } });

    const { status } = await as(ana).post('/meetings', newMeeting({ startTime: '09:00' }));

    assert.equal(status, 201);
  });

  test('a agenda dos convidados não é verificada ao criar', async () => {
    await insertMeeting({ date: DAY, startTime: '09:00', organizerId: carla, participants: { [carla]: 'accepted' } });

    const { status } = await as(ana).post('/meetings', newMeeting({ startTime: '09:00', participantIds: [carla] }));

    assert.equal(status, 201);
  });

  test('400 para campos em falta, data no passado, data inválida e convidado inexistente', async () => {
    const cases = [
      newMeeting({ title: '' }),
      newMeeting({ date: daysFromNow(-1) }),
      newMeeting({ date: 'amanhã' }),
      newMeeting({ date: '2031-02-30' }),
      newMeeting({ startTime: '24:00' }),
      newMeeting({ participantIds: ['f'.repeat(24)] }),
    ];
    for (const body of cases) {
      const res = await as(ana).post('/meetings', body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(await MeetingModel.countDocuments(), 0);
  });
});

describe('GET /meetings/:id', () => {
  test('devolve o detalhe com organizador e participantes populados', async () => {
    const id = await insertMeeting({ date: DAY, startTime: '09:00', organizerId: ana, participants: { [ana]: 'accepted', [carla]: 'pending' } });

    const { status, body } = await as(carla).get(`/meetings/${id}`);

    assert.equal(status, 200);
    assert.deepEqual(body.organizerId, { _id: ana, name: 'ana', username: 'ana' });
    assert.deepEqual(
      body.participants.map((p) => [p.userId.username, p.status]),
      [
        ['ana', 'accepted'],
        ['carla', 'pending'],
      ],
    );
  });

  test('403 para quem não é organizador nem participante; 404 para id inválido ou inexistente', async () => {
    const id = await insertMeeting({ date: DAY, startTime: '09:00', organizerId: ana, participants: { [ana]: 'accepted' } });

    assert.equal((await as(elena).get(`/meetings/${id}`)).status, 403);
    assert.equal((await as(ana).get('/meetings/lixo')).status, 404);
    assert.equal((await as(ana).get(`/meetings/${'e'.repeat(24)}`)).status, 404);
  });
});

describe('PATCH /meetings/:id/invites/:userId', () => {
  let invitation;

  beforeEach(async () => {
    invitation = await insertMeeting({
      date: DAY,
      startTime: '10:30',
      organizerId: carla,
      participants: { [carla]: 'accepted', [ana]: 'pending' },
    });
  });

  const respond = (user, status, meetingId = invitation) => as(user).patch(`/meetings/${meetingId}/invites/${user}`, { status });
  const storedStatus = async (userId) => {
    const doc = await MeetingModel.findById(invitation).lean();
    return doc.participants.find((p) => String(p.userId) === userId).status;
  };

  test('aceitar sem conflito grava a resposta', async () => {
    const { status } = await respond(ana, 'accepted');

    assert.equal(status, 200);
    assert.equal(await storedStatus(ana), 'accepted');
  });

  test('aceitar com conflito na agenda dá 409 e não grava nada', async () => {
    await insertMeeting({ date: DAY, startTime: '10:00', organizerId: ana, participants: { [ana]: 'accepted' } });

    const { status } = await respond(ana, 'accepted');

    assert.equal(status, 409);
    assert.equal(await storedStatus(ana), 'pending');
  });

  test('voltar a aceitar um convite já aceite não entra em conflito consigo próprio', async () => {
    assert.equal((await respond(ana, 'accepted')).status, 200);
    assert.equal((await respond(ana, 'accepted')).status, 200);
  });

  test('recusar nunca é bloqueado, mesmo com conflito', async () => {
    await insertMeeting({ date: DAY, startTime: '10:00', organizerId: ana, participants: { [ana]: 'accepted' } });

    assert.equal((await respond(ana, 'declined')).status, 200);
    assert.equal(await storedStatus(ana), 'declined');
  });

  test('pode-se mudar de ideias: recusar e depois aceitar', async () => {
    assert.equal((await respond(ana, 'declined')).status, 200);
    assert.equal((await respond(ana, 'accepted')).status, 200);
    assert.equal(await storedStatus(ana), 'accepted');
  });

  test('erros: quem não foi convidado (404), por outra pessoa (403), organizador a recusar (403), estado inválido (400)', async () => {
    assert.equal((await respond(diogo, 'accepted')).status, 404);
    assert.equal((await as(ana).patch(`/meetings/${invitation}/invites/${carla}`, { status: 'accepted' })).status, 403);
    assert.equal((await respond(carla, 'declined')).status, 403);
    assert.equal((await respond(ana, 'pending')).status, 400);
    assert.equal((await respond(ana, 'accepted', 'e'.repeat(24))).status, 404);
    assert.equal(await storedStatus(carla), 'accepted');
    assert.equal(await storedStatus(ana), 'pending');
  });
});

describe('Identificação do utilizador (X-User-Id)', () => {
  test('401 sem header, com id inválido ou com um utilizador que não existe', async () => {
    assert.equal((await request(ctx, null, 'GET', '/meetings')).status, 401);
    assert.equal((await request(ctx, 'lixo', 'GET', '/meetings')).status, 401);
    assert.equal((await request(ctx, 'f'.repeat(24), 'GET', '/meetings')).status, 401);
  });
});

describe('GET /users', () => {
  test('pesquisa por username, sem distinguir maiúsculas, e sem termo devolve todos', async () => {
    const found = await as(ana).get('/users?q=CAR');
    const all = await as(ana).get('/users');

    assert.deepEqual(
      found.body.map((u) => u.username),
      ['carla'],
    );
    assert.equal(all.body.length, 4);
  });
});

describe('GET /users — o texto da pesquisa é literal, não uma expressão regular', () => {
  test('caracteres especiais não dão erro e não têm significado especial', async () => {
    await createUsers('ana.silva', 'anaXsilva', 'joao(2)');

    const parenthesis = await as(ana).get(`/users?q=${encodeURIComponent('(')}`);
    const bracket = await as(ana).get(`/users?q=${encodeURIComponent('[')}`);
    const dot = await as(ana).get(`/users?q=${encodeURIComponent('ana.silva')}`);
    const star = await as(ana).get(`/users?q=${encodeURIComponent('.*')}`);

    assert.equal(parenthesis.status, 200);
    assert.deepEqual(
      parenthesis.body.map((u) => u.username),
      ['joao(2)'],
    );
    assert.equal(bracket.status, 200);
    assert.deepEqual(bracket.body, []);
    assert.deepEqual(
      dot.body.map((u) => u.username),
      ['ana.silva'],
    );
    assert.deepEqual(star.body, []);
  });
});
