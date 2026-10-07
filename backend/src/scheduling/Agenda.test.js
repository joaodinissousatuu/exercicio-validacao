import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agenda } from './Agenda.js';
import { TimeSlot } from './TimeSlot.js';

function slot(date, start, end) {
  return new TimeSlot(new Date(`${date}T${start}`), new Date(`${date}T${end}`));
}

test('sem conflito: nenhum bloco da agenda se sobrepõe ao candidato', () => {
  const candidate = slot('2026-09-10', '09:00', '10:00');
  const agenda = [
    slot('2026-09-10', '11:00', '12:00'),
    slot('2026-09-11', '09:00', '10:00'), // dia diferente
  ];
  assert.equal(new Agenda(agenda).conflictsWith(candidate), false);
});

test('com conflito: pelo menos um bloco da agenda sobrepõe-se ao candidato', () => {
  const candidate = slot('2026-09-10', '09:00', '10:00');
  const agenda = [
    slot('2026-09-10', '11:00', '12:00'), // sem sobreposição
    slot('2026-09-10', '09:30', '10:30'), // sobrepõe-se
  ];
  assert.equal(new Agenda(agenda).conflictsWith(candidate), true);
});

test('agenda vazia: devolve false', () => {
  const candidate = slot('2026-09-10', '09:00', '10:00');
  assert.equal(new Agenda([]).conflictsWith(candidate), false);
});

test('limite: candidato que começa quando um bloco da agenda acaba não é conflito', () => {
  const candidate = slot('2026-09-10', '10:00', '11:00');
  const agenda = [slot('2026-09-10', '09:00', '10:00')];
  assert.equal(new Agenda(agenda).conflictsWith(candidate), false);
});

test('Agenda é imutável: alterar a lista original não muda a agenda', () => {
  const slots = [slot('2026-09-10', '09:00', '10:00')];
  const agenda = new Agenda(slots);
  slots.push(slot('2026-09-10', '11:00', '12:00'));

  assert.equal(agenda.slots.length, 1);
  assert.equal(agenda.conflictsWith(slot('2026-09-10', '11:30', '12:30')), false);
  assert.equal(Object.isFrozen(agenda), true);
});
