import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasConflict } from './conflictService.js';

test('sem conflito: nenhuma reunião aceite se sobrepõe à candidata', () => {
  const candidate = { date: '2026-09-10', startTime: '09:00' }; // 09:00 - 10:00
  const acceptedMeetings = [
    { _id: 'a', date: '2026-09-10', startTime: '11:00' }, // 11:00 - 12:00
    { _id: 'b', date: '2026-09-11', startTime: '09:00' }, // dia diferente
  ];
  assert.equal(hasConflict(candidate, acceptedMeetings), false);
});

test('com conflito: pelo menos uma reunião aceite sobrepõe-se à candidata', () => {
  const candidate = { date: '2026-09-10', startTime: '09:00' }; // 09:00 - 10:00
  const acceptedMeetings = [
    { _id: 'a', date: '2026-09-10', startTime: '11:00' }, // sem sobreposição
    { _id: 'b', date: '2026-09-10', startTime: '09:30' }, // sobrepõe-se
  ];
  assert.equal(hasConflict(candidate, acceptedMeetings), true);
});

test('lista vazia de reuniões aceites: devolve false', () => {
  const candidate = { date: '2026-09-10', startTime: '09:00' };
  assert.equal(hasConflict(candidate, []), false);
});

test('excludeMeetingId exclui a própria reunião da comparação, mesmo sobrepondo-se a si mesma', () => {
  const candidate = { _id: 'self', date: '2026-09-10', startTime: '09:00' };
  const acceptedMeetings = [
    { _id: 'self', date: '2026-09-10', startTime: '09:00' }, // a própria reunião, na lista
  ];
  assert.equal(hasConflict(candidate, acceptedMeetings, 'self'), false);
});

test('excludeMeetingId ignora só a reunião excluída, continua a detetar conflito com as restantes', () => {
  const candidate = { _id: 'self', date: '2026-09-10', startTime: '09:00' };
  const acceptedMeetings = [
    { _id: 'self', date: '2026-09-10', startTime: '09:00' }, // excluída
    { _id: 'other', date: '2026-09-10', startTime: '09:30' }, // sobrepõe-se, não é excluída
  ];
  assert.equal(hasConflict(candidate, acceptedMeetings, 'self'), true);
});

test('sem excludeMeetingId (undefined): verifica contra todas as reuniões da lista, sem exceção', () => {
  // Caso do POST /meetings: a reunião candidata ainda não tem _id, não há nada a excluir.
  const candidate = { date: '2026-09-10', startTime: '09:00' };
  const acceptedMeetings = [{ _id: 'a', date: '2026-09-10', startTime: '09:30' }];
  assert.equal(hasConflict(candidate, acceptedMeetings, undefined), true);
});
