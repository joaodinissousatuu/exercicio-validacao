import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Meeting, meetingTimeSlot, MEETING_DURATION_MINUTES } from './Meeting.js';

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

test('respondToInvite: atualiza o estado do participante certo e devolve-o', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const carlaId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({
    organizerId,
    participants: [
      { userId: organizerId, status: 'accepted' },
      { userId: carlaId, status: 'pending' },
    ],
  });

  const updated = meeting.respondToInvite(String(carlaId), 'accepted');

  assert.equal(updated?.status, 'accepted');
  assert.equal(meeting.findParticipant(String(carlaId))?.status, 'accepted');
  // não mexe nos outros participantes
  assert.equal(meeting.findParticipant(String(organizerId))?.status, 'accepted');
});

test('respondToInvite: devolve null e não altera nada se o utilizador não foi convidado', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  const result = meeting.respondToInvite(String(new mongoose.Types.ObjectId()), 'accepted');

  assert.equal(result, null);
  assert.equal(meeting.participants.length, 1);
  assert.equal(meeting.participants[0].status, 'accepted');
});

test('timeSlot: uma reunião ocupa 1h a partir da hora de início', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  const slot = meeting.timeSlot();

  assert.equal(MEETING_DURATION_MINUTES, 60);
  assert.deepEqual(slot, { start: new Date('2026-09-10T09:00'), end: new Date('2026-09-10T10:00') });
});

test('meetingTimeSlot: dá o mesmo bloco de tempo antes de a reunião existir (usado ao criar)', () => {
  const organizerId = new mongoose.Types.ObjectId();
  const meeting = makeMeeting({ organizerId, participants: [{ userId: organizerId, status: 'accepted' }] });

  assert.deepEqual(meetingTimeSlot({ date: '2026-09-10', startTime: '09:00' }), meeting.timeSlot());
});
