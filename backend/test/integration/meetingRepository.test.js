import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { meetingRepository, ConcurrentModificationError } from '../../src/meetings/meetingRepository.js';
import { meetingTimeSlot } from '../../src/meetings/Meeting.js';
import { scheduleMeeting } from '../../src/meetings/commitmentPolicy.js';
import { toMeetingDto } from '../../src/meetings/meetingDto.js';
import { Agenda } from '../../src/scheduling/Agenda.js';
import { MeetingModel } from '../../src/meetings/MeetingModel.js';
import { useTestServer, createUsers, insertMeeting, daysFromNow } from './helpers.js';

// Testes de integração do repositório de reuniões contra um MongoDB verdadeiro:
// a query da agenda, a tradução documento ↔ agregado, e a concorrência otimista
// do save() (SPEC.md §17) — esta de forma determinística, sem depender de timing.

useTestServer();
const DAY = daysFromNow(2);

let ana;
let carla;
let diogo;

beforeEach(async () => {
  [ana, carla, diogo] = await createUsers('ana', 'carla', 'diogo');
});

describe('save(): concorrência otimista', () => {
  test('duas respostas à mesma reunião lidas ao mesmo tempo: a segunda gravação falha em vez de apagar a primeira', async () => {
    const id = await insertMeeting({
      date: DAY,
      startTime: '09:00',
      organizerId: ana,
      participants: { [ana]: 'accepted', [carla]: 'pending', [diogo]: 'pending' },
    });

    // As duas pessoas leem a reunião antes de qualquer uma gravar.
    const readByCarla = await meetingRepository.findById(id);
    const readByDiogo = await meetingRepository.findById(id);

    readByCarla.respondToInvite(carla, 'accepted');
    await meetingRepository.save(readByCarla);

    readByDiogo.respondToInvite(diogo, 'declined');
    await assert.rejects(meetingRepository.save(readByDiogo), ConcurrentModificationError);

    // A resposta da Carla não se perdeu, e a do Diogo não foi gravada (pode repetir).
    const stored = await meetingRepository.findById(id);
    assert.equal(stored.inviteStatusOf(carla), 'accepted');
    assert.equal(stored.inviteStatusOf(diogo), 'pending');
  });

  test('depois de uma gravação, a mesma instância pode voltar a gravar (a versão acompanha)', async () => {
    const id = await insertMeeting({ date: DAY, startTime: '09:00', organizerId: ana, participants: { [ana]: 'accepted', [carla]: 'pending' } });
    const meeting = await meetingRepository.findById(id);

    meeting.respondToInvite(carla, 'accepted');
    await meetingRepository.save(meeting);
    meeting.respondToInvite(carla, 'declined');
    await meetingRepository.save(meeting);

    assert.equal((await meetingRepository.findById(id)).inviteStatusOf(carla), 'declined');
  });

  test('um documento gravado sem __v (fora do Mongoose) conta como versão 0', async () => {
    const id = await insertMeeting({ date: DAY, startTime: '09:00', organizerId: ana, participants: { [ana]: 'accepted', [carla]: 'pending' } });
    await MeetingModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $unset: { __v: '' } });
    const meeting = await meetingRepository.findById(id);

    meeting.respondToInvite(carla, 'accepted');
    await meetingRepository.save(meeting);

    assert.equal((await meetingRepository.findById(id)).inviteStatusOf(carla), 'accepted');
  });
});

describe('findAgendaOf()', () => {
  test('só inclui as reuniões que o utilizador aceitou, e pode excluir uma', async () => {
    const accepted = await insertMeeting({ date: DAY, startTime: '09:00', organizerId: ana, participants: { [ana]: 'accepted' } });
    await insertMeeting({ date: DAY, startTime: '11:00', organizerId: carla, participants: { [carla]: 'accepted', [ana]: 'pending' } });
    await insertMeeting({ date: DAY, startTime: '13:00', organizerId: carla, participants: { [carla]: 'accepted', [ana]: 'declined' } });

    const agenda = await meetingRepository.findAgendaOf(ana);
    const withoutAccepted = await meetingRepository.findAgendaOf(ana, accepted);

    assert.ok(agenda instanceof Agenda);
    assert.deepEqual(agenda.slots, [meetingTimeSlot({ date: DAY, startTime: '09:00' })]);
    assert.equal(withoutAccepted.slots.length, 0);
  });
});

describe('create() e leitura', () => {
  test('grava o agregado construído pela política e lê-o de volta igual', async () => {
    const meeting = scheduleMeeting(
      { title: 'T', description: 'D', date: DAY, startTime: '09:00', organizerId: ana, inviteeIds: [carla] },
      new Agenda([]),
    );

    const created = await meetingRepository.create(meeting);
    const read = await meetingRepository.findById(created._id);

    assert.match(created._id, /^[0-9a-f]{24}$/);
    assert.deepEqual(
      toMeetingDto(read),
      { ...toMeetingDto(meeting), _id: created._id },
    );
  });

  test('findById com um id de formato inválido devolve null (o formato é detalhe do repositório)', async () => {
    assert.equal(await meetingRepository.findById('lixo'), null);
    assert.equal(await meetingRepository.findById('e'.repeat(24)), null);
  });
});
