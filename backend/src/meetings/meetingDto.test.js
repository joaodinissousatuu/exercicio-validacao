import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Meeting } from './Meeting.js';
import { User } from '../users/User.js';
import { toMeetingDto, toMeetingListItemDto, toMeetingDetailDto } from './meetingDto.js';

// A forma das respostas da API (Published Language, SPEC.md §13) — campos, ordem e
// valores. Estes testes falham se uma mudança no domínio mudar o contrato sem querer.

const ANA = 'a'.repeat(24);
const CARLA = 'c'.repeat(24);

const meeting = new Meeting({
  _id: 'm1',
  title: 'Reunião',
  description: 'Descrição',
  date: '2026-09-10',
  startTime: '09:00',
  organizerId: ANA,
  participants: [
    { userId: ANA, status: 'accepted' },
    { userId: CARLA, status: 'pending' },
  ],
});

test('toMeetingDto: a mesma forma de sempre, com os utilizadores por id', () => {
  assert.equal(
    JSON.stringify(toMeetingDto(meeting)),
    JSON.stringify({
      _id: 'm1',
      title: 'Reunião',
      description: 'Descrição',
      date: '2026-09-10',
      startTime: '09:00',
      organizerId: ANA,
      participants: [
        { userId: ANA, status: 'accepted' },
        { userId: CARLA, status: 'pending' },
      ],
    }),
  );
});

test('toMeetingListItemDto: acrescenta myInviteStatus e hasConflict, no fim', () => {
  const dto = toMeetingListItemDto(meeting, { myInviteStatus: 'pending', hasConflict: true });

  assert.deepEqual(Object.keys(dto), [
    '_id',
    'title',
    'description',
    'date',
    'startTime',
    'organizerId',
    'participants',
    'myInviteStatus',
    'hasConflict',
  ]);
  assert.equal(dto.myInviteStatus, 'pending');
  assert.equal(dto.hasConflict, true);
});

test('toMeetingDetailDto: organizador e participantes com nome e username', () => {
  const users = [new User({ _id: CARLA, name: 'Carla', username: 'carla' }), new User({ _id: ANA, name: 'Ana', username: 'ana' })];

  const dto = toMeetingDetailDto(meeting, users);

  assert.deepEqual(dto.organizerId, { _id: ANA, name: 'Ana', username: 'ana' });
  assert.deepEqual(dto.participants, [
    { userId: { _id: ANA, name: 'Ana', username: 'ana' }, status: 'accepted' },
    { userId: { _id: CARLA, name: 'Carla', username: 'carla' }, status: 'pending' },
  ]);
});

test('toMeetingDetailDto: um utilizador que já não exista aparece como null', () => {
  const dto = toMeetingDetailDto(meeting, [new User({ _id: ANA, name: 'Ana', username: 'ana' })]);

  assert.equal(dto.participants[1].userId, null);
});

test('os DTOs são cópias: alterá-los não muda a reunião', () => {
  const dto = toMeetingDto(meeting);
  dto.participants[1].status = 'accepted';

  assert.equal(meeting.inviteStatusOf(CARLA), 'pending');
});
