import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agenda } from '../scheduling/Agenda.js';
import { Meeting, meetingTimeSlot, InvalidScheduleError, NotInvitedError, OrganizerCannotDeclineError } from './Meeting.js';
import {
  scheduleMeeting,
  respondToInvite,
  wouldConflict,
  ScheduleConflictError,
  MeetingInPastError,
} from './commitmentPolicy.js';

// Testes do Core Domain (SPEC.md §19) — sem HTTP nem base de dados. Até à §19
// estas regras viviam em meetings/routes.js e só eram testadas à mão.

const ANA = 'a'.repeat(24);
const CARLA = 'c'.repeat(24);
const DIOGO = 'd'.repeat(24);
const NOW = new Date('2026-09-01T12:00').getTime();
const EMPTY = new Agenda([]);

function agendaWith(...schedules) {
  return new Agenda(schedules.map(([date, startTime]) => meetingTimeSlot({ date, startTime })));
}

function request(overrides = {}) {
  return {
    title: 'Reunião',
    description: 'Descrição',
    date: '2026-09-10',
    startTime: '09:00',
    organizerId: ANA,
    inviteeIds: [],
    ...overrides,
  };
}

/** @param {{ startTime?: string, carla?: import('./InviteStatus.js').InviteStatusValue }} [options] */
function invitation({ startTime = '09:00', carla = 'pending' } = {}) {
  return new Meeting({
    _id: 'm1',
    title: 'Reunião',
    description: 'Descrição',
    date: '2026-09-10',
    startTime,
    organizerId: ANA,
    participants: [
      { userId: ANA, status: 'accepted' },
      { userId: CARLA, status: carla },
    ],
  });
}

test('scheduleMeeting: o organizador fica aceite e cada convidado fica pendente', () => {
  const meeting = scheduleMeeting(request({ inviteeIds: [CARLA, DIOGO] }), EMPTY, NOW);

  assert.equal(meeting.inviteStatusOf(ANA), 'accepted');
  assert.equal(meeting.inviteStatusOf(CARLA), 'pending');
  assert.equal(meeting.inviteStatusOf(DIOGO), 'pending');
  assert.equal(meeting.isOrganizer(ANA), true);
});

test('scheduleMeeting: o organizador não se convida a si próprio, e ninguém é convidado duas vezes', () => {
  const meeting = scheduleMeeting(request({ inviteeIds: [CARLA, ANA, CARLA] }), EMPTY, NOW);

  assert.deepEqual(
    meeting.participants.map((p) => p.userId),
    [ANA, CARLA],
  );
});

test('scheduleMeeting: criar compromete o organizador, por isso tem de caber na agenda dele', () => {
  const agenda = agendaWith(['2026-09-10', '08:30']); // 08:30-09:30

  assert.throws(() => scheduleMeeting(request(), agenda, NOW), ScheduleConflictError);
});

test('scheduleMeeting: logo a seguir a outro compromisso (no limite) não é conflito', () => {
  const agenda = agendaWith(['2026-09-10', '08:00']); // 08:00-09:00

  assert.doesNotThrow(() => scheduleMeeting(request(), agenda, NOW));
});

test('scheduleMeeting: a agenda dos convidados não é verificada ao criar (só quando aceitarem)', () => {
  // A agenda passada é só a do organizador; os convidados ficam pendentes, e convites
  // pendentes não ocupam tempo (SPEC.md §4).
  assert.doesNotThrow(() => scheduleMeeting(request({ inviteeIds: [CARLA] }), EMPTY, NOW));
});

test('scheduleMeeting: recusa reuniões no passado, e data ou hora inválidas', () => {
  assert.throws(() => scheduleMeeting(request({ date: '2026-08-31' }), EMPTY, NOW), MeetingInPastError);
  assert.throws(() => scheduleMeeting(request({ date: 'amanhã' }), EMPTY, NOW), InvalidScheduleError);
});

test('respondToInvite: aceitar compromete quem aceita, por isso tem de caber na agenda dele', () => {
  const meeting = invitation();
  const agenda = agendaWith(['2026-09-10', '09:30']);

  assert.throws(() => respondToInvite(meeting, CARLA, 'accepted', agenda), ScheduleConflictError);
  assert.equal(meeting.inviteStatusOf(CARLA), 'pending');
});

test('respondToInvite: aceitar sem conflito regista a resposta', () => {
  const meeting = invitation();

  respondToInvite(meeting, CARLA, 'accepted', agendaWith(['2026-09-10', '11:00']));

  assert.equal(meeting.inviteStatusOf(CARLA), 'accepted');
});

test('respondToInvite: recusar nunca é bloqueado, mesmo com conflito na agenda', () => {
  const meeting = invitation();

  respondToInvite(meeting, CARLA, 'declined', agendaWith(['2026-09-10', '09:30']));

  assert.equal(meeting.inviteStatusOf(CARLA), 'declined');
});

test('respondToInvite: quem não foi convidado recebe NotInvitedError, mesmo que houvesse conflito', () => {
  const agenda = agendaWith(['2026-09-10', '09:30']);

  assert.throws(() => respondToInvite(invitation(), DIOGO, 'accepted', agenda), NotInvitedError);
});

test('respondToInvite: as regras do agregado continuam a aplicar-se (convidado, organizador)', () => {
  assert.throws(() => respondToInvite(invitation(), DIOGO, 'accepted', EMPTY), NotInvitedError);
  assert.throws(() => respondToInvite(invitation(), ANA, 'declined', EMPTY), OrganizerCannotDeclineError);
});

test('wouldConflict: só avisa sobre convites pendentes que não cabem na agenda', () => {
  const agenda = agendaWith(['2026-09-10', '09:30']);

  assert.equal(wouldConflict(invitation(), CARLA, agenda), true);
  assert.equal(wouldConflict(invitation({ startTime: '11:00' }), CARLA, agenda), false);
  assert.equal(wouldConflict(invitation({ carla: 'declined' }), CARLA, agenda), false);
  assert.equal(wouldConflict(invitation(), ANA, agenda), false); // o organizador já aceitou
});
