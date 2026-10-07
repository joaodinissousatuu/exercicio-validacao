import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  Meeting,
  meetingTimeSlot,
  MEETING_DURATION_MINUTES,
  InvalidScheduleError,
  InvalidMeetingError,
  NotInvitedError,
  OrganizerCannotDeclineError,
  agendaOf,
} from './Meeting.js';

// Testes do comportamento do agregado (Meeting.js) — construídos com `new Meeting(...)`,
// sem qualquer ligação à base de dados: instanciar um documento e chamar os seus métodos
// não precisa de Mongo, só gravar (`.save()`) precisa. Isto mantém estes testes tão
// isolados como os de scheduling/overlap.test.js e scheduling/conflictService.test.js.

function makeMeeting({ organizerId, participants }) {
  return new Meeting({
    title: 'Reunião de teste',
    description: 'Descrição',
    date: '2026-09-10',
    startTime: '09:00',
    organizerId,
    participants,
  });
}

test('findParticipant: encontra o participante pelo userId', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'pending' },
    ],
  });

  assert.equal(meeting.findParticipant(String(carlaId))?.status, 'pending');
});

test('findParticipant: devolve null se o utilizador não foi convidado', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  assert.equal(meeting.findParticipant(String(new mongoose.Types.ObjectId())), null);
});

test('isOrganizer: verdadeiro só para o organizador', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'pending' },
    ],
  });

  assert.equal(meeting.isOrganizer(String(organizerId)), true);
  assert.equal(meeting.isOrganizer(String(carlaId)), false);
});

test('hasAccess: verdadeiro para organizador e para participante convidado, falso para terceiros', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const outsiderId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'pending' },
    ],
  });

  assert.equal(meeting.hasAccess(String(organizerId)), true);
  assert.equal(meeting.hasAccess(String(carlaId)), true);
  assert.equal(meeting.hasAccess(String(outsiderId)), false);
});

test('isAcceptedBy / isPendingFor: refletem o status do participante', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'pending' },
    ],
  });

  assert.equal(meeting.isAcceptedBy(String(organizerId)), true);
  assert.equal(meeting.isPendingFor(String(organizerId)), false);
  assert.equal(meeting.isAcceptedBy(String(carlaId)), false);
  assert.equal(meeting.isPendingFor(String(carlaId)), true);
});

test('isAcceptedBy / isPendingFor: falso para quem não foi convidado', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });
  const outsiderId = String(new mongoose.Types.ObjectId());

  assert.equal(meeting.isAcceptedBy(outsiderId), false);
  assert.equal(meeting.isPendingFor(outsiderId), false);
});

test('respondToInvite: atualiza o estado do participante certo, sem devolver nada (comando puro)', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'pending' },
    ],
  });

  const result = meeting.respondToInvite(String(carlaId), 'accepted');

  assert.equal(result, undefined);
  assert.equal(meeting.inviteStatusOf(String(carlaId)), 'accepted');
  // não mexe nos outros participantes
  assert.equal(meeting.findParticipant(String(organizerId))?.status, 'accepted');
});

test('respondToInvite: lança NotInvitedError e não altera nada se o utilizador não foi convidado', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  assert.throws(() => meeting.respondToInvite(String(new mongoose.Types.ObjectId()), 'accepted'), NotInvitedError);
  assert.equal(meeting.participants.length, 1);
  assert.equal(meeting.participants[0].status, 'accepted');
});

test('timeSlot: uma reunião ocupa 1h a partir da hora de início', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  const slot = meeting.timeSlot();

  assert.equal(MEETING_DURATION_MINUTES, 60);
  assert.deepEqual(slot.start, new Date('2026-09-10T09:00'));
  assert.deepEqual(slot.end, new Date('2026-09-10T10:00'));
});

test('meetingTimeSlot: dá o mesmo bloco de tempo antes de a reunião existir (usado ao criar)', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  assert.deepEqual(meetingTimeSlot({ date: '2026-09-10', startTime: '09:00' }), meeting.timeSlot());
});

test('meetingTimeSlot: rejeita data ou hora que não estão no formato YYYY-MM-DD / HH:mm', () => {
  const invalid = [
    { date: 'amanhã', startTime: '10:00' },
    { date: '2026-09-10', startTime: '10h' },
    { date: '10/09/2026', startTime: '10:00' },
    { date: '2026-09-10', startTime: '9:00' },
    { date: '', startTime: '' },
    { date: undefined, startTime: undefined },
  ];
  for (const schedule of invalid) {
    assert.throws(() => meetingTimeSlot(schedule), InvalidScheduleError, JSON.stringify(schedule));
  }
});

test('meetingTimeSlot: rejeita datas e horas que não existem (o Date do JS corrigia-as em silêncio)', () => {
  const invalid = [
    { date: '2026-02-30', startTime: '10:00' }, // viraria 2 de março
    { date: '2026-13-01', startTime: '10:00' },
    { date: '2026-09-10', startTime: '24:00' }, // viraria 00:00 do dia seguinte
    { date: '2026-09-10', startTime: '10:60' },
  ];
  for (const schedule of invalid) {
    assert.throws(() => meetingTimeSlot(schedule), InvalidScheduleError, JSON.stringify(schedule));
  }
});

test('meetingTimeSlot: aceita datas válidas, incluindo 29 de fevereiro em ano bissexto e 23:59', () => {
  assert.doesNotThrow(() => meetingTimeSlot({ date: '2028-02-29', startTime: '23:59' }));
  assert.throws(() => meetingTimeSlot({ date: '2027-02-29', startTime: '10:00' }), InvalidScheduleError);
});

test('respondToInvite: o organizador não pode recusar a própria reunião', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  assert.throws(() => meeting.respondToInvite(String(organizerId), 'declined'), OrganizerCannotDeclineError);
  assert.equal(meeting.findParticipant(String(organizerId))?.status, 'accepted');
});

test('respondToInvite: o organizador pode voltar a aceitar (não muda nada)', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  meeting.respondToInvite(String(organizerId), 'accepted');
  assert.equal(meeting.inviteStatusOf(String(organizerId)), 'accepted');
});

test('respondToInvite: recusa respostas que não são aceitar nem recusar (voltar a pendente não é resposta)', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'accepted' },
    ],
  });

  // @ts-expect-error -- valor inválido de propósito: é isto que o teste verifica
  assert.throws(() => meeting.respondToInvite(String(carlaId), 'pending'), TypeError);
  // @ts-expect-error -- valor inválido de propósito: é isto que o teste verifica
  assert.throws(() => meeting.respondToInvite(String(carlaId), 'talvez'), TypeError);
  assert.equal(meeting.inviteStatusOf(String(carlaId)), 'accepted');
});

test('inviteStatusOf: estado do convite de cada participante, ou null para quem não foi convidado', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'declined' },
    ],
  });

  assert.equal(meeting.inviteStatusOf(String(organizerId)), 'accepted');
  assert.equal(meeting.inviteStatusOf(String(carlaId)), 'declined');
  assert.equal(meeting.inviteStatusOf(String(new mongoose.Types.ObjectId())), null);
});

test('invariantes: o mesmo utilizador não pode aparecer duas vezes nos participantes', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();

  assert.throws(
    () =>
      makeMeeting({
        organizerId,
        participants: [
          { userId: organizerId, status: 'accepted' },
          { userId: carlaId, status: 'pending' },
          { userId: String(carlaId), status: 'pending' },
        ],
      }),
    InvalidMeetingError,
  );
});

test('invariantes: o organizador tem de ser participante, com o convite aceite', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();

  assert.throws(() => makeMeeting({ organizerId, participants: [{ userId: carlaId, status: 'pending' }] }), InvalidMeetingError);
  assert.throws(
    () => makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'declined' }] }),
    InvalidMeetingError,
  );
});

test('invariantes: estados de convite desconhecidos são recusados', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();

  assert.throws(
    () =>
      makeMeeting({
        organizerId,
        participants: [
          { userId: organizerId, status: 'accepted' },
          { userId: carlaId, status: 'talvez' },
        ],
      }),
    InvalidMeetingError,
  );
});

test('agendaOf: a agenda das reuniões aceites deteta conflito com o bloco de tempo de outra reunião', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const participants = [{ userId: organizerId, status: 'accepted' }];
  const accepted = makeMeeting({ organizerId, participants }); // 2026-09-10, 09:00-10:00
  const sameDay = {
    title: 'T',
    description: 'D',
    date: '2026-09-10',
    organizerId: String(organizerId),
    participants: [{ userId: String(organizerId), status: /** @type {const} */ ('accepted') }],
  };
  const candidate = new Meeting({ ...sameDay, startTime: '09:30' });
  const later = new Meeting({ ...sameDay, startTime: '10:00' });

  const agenda = agendaOf([accepted]);

  assert.equal(agenda.conflictsWith(candidate.timeSlot()), true);
  assert.equal(agenda.conflictsWith(later.timeSlot()), false);
});

test('encapsulamento: alterar a lista devolvida por `participants` não muda a reunião', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  // @ts-expect-error -- alteração proibida de propósito: é isto que o teste verifica
  assert.throws(() => meeting.participants.push({ userId: carlaId, status: 'accepted' }), TypeError);
  assert.throws(() => {
    // @ts-expect-error -- alteração proibida de propósito: é isto que o teste verifica
    meeting.participants[0].status = 'declined';
  }, TypeError);
  assert.equal(meeting.participants.length, 1);
  assert.equal(meeting.inviteStatusOf(String(organizerId)), 'accepted');
});

test('encapsulamento: alterar o participante devolvido por findParticipant não muda o convite', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  assert.throws(() => {
    // @ts-expect-error -- alteração proibida de propósito: é isto que o teste verifica
    meeting.findParticipant(String(organizerId)).status = 'declined';
  }, TypeError);
  assert.equal(meeting.inviteStatusOf(String(organizerId)), 'accepted');
});

test('encapsulamento: alterar o array passado ao construtor, depois de criar, não muda a reunião', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const participants = [{ userId: organizerId, status: 'accepted' }];
  const meeting = makeMeeting({ organizerId, participants });

  participants.push({ userId: carlaId, status: 'accepted' });
  participants[0].status = 'declined';

  assert.equal(meeting.participants.length, 1);
  assert.equal(meeting.inviteStatusOf(String(organizerId)), 'accepted');
});

test('encapsulamento: os campos da reunião não podem ser reatribuídos de fora', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  assert.throws(() => {
    meeting.date = 'amanhã';
  }, TypeError);
  assert.equal(meeting.date, '2026-09-10');
});
