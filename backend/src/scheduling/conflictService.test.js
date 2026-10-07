import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasConflict } from './conflictService.js';

function slot(date, start, end) {
  return { start: new Date(`${date}T${start}`), end: new Date(`${date}T${end}`) };
}

test('sem conflito: nenhum bloco da agenda se sobrepõe ao candidato', () => {
  const candidate = slot('2026-09-10', '09:00', '10:00');
  const agenda = [
    slot('2026-09-10', '11:00', '12:00'),
    slot('2026-09-11', '09:00', '10:00'), // dia diferente
  ];
  assert.equal(hasConflict(candidate, agenda), false);
});

test('com conflito: pelo menos um bloco da agenda sobrepõe-se ao candidato', () => {
  const candidate = slot('2026-09-10', '09:00', '10:00');
  const agenda = [
    slot('2026-09-10', '11:00', '12:00'), // sem sobreposição
    slot('2026-09-10', '09:30', '10:30'), // sobrepõe-se
  ];
  assert.equal(hasConflict(candidate, agenda), true);
});

test('agenda vazia: devolve false', () => {
  const candidate = slot('2026-09-10', '09:00', '10:00');
  assert.equal(hasConflict(candidate, []), false);
});

test('limite: candidato que começa quando um bloco da agenda acaba não é conflito', () => {
  const candidate = slot('2026-09-10', '10:00', '11:00');
  const agenda = [slot('2026-09-10', '09:00', '10:00')];
  assert.equal(hasConflict(candidate, agenda), false);
});
