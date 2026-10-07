import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlap, TimeSlot } from './overlap.js';

// Blocos de tempo construídos à mão, com início e fim explícitos — o Scheduling
// não sabe que as reuniões duram 1h (isso é regra de Meetings, testada em
// meetings/Meeting.test.js).
function slot(date, start, end) {
  return new TimeSlot(new Date(`${date}T${start}`), new Date(`${date}T${end}`));
}

test('sem sobreposição: blocos em horas separadas no mesmo dia', () => {
  const a = slot('2026-09-10', '09:00', '10:00');
  const b = slot('2026-09-10', '11:00', '12:00');
  assert.equal(overlap(a, b), false);
});

test('sobreposição total: o mesmo bloco exato', () => {
  const a = slot('2026-09-10', '09:00', '10:00');
  const b = slot('2026-09-10', '09:00', '10:00');
  assert.equal(overlap(a, b), true);
});

test('sobreposição parcial: B começa antes de A terminar', () => {
  const a = slot('2026-09-10', '09:00', '10:00');
  const b = slot('2026-09-10', '09:30', '10:30');
  assert.equal(overlap(a, b), true);
});

test('limite: A termina exatamente quando B começa não é conflito', () => {
  const a = slot('2026-09-10', '09:00', '10:00');
  const b = slot('2026-09-10', '10:00', '11:00');
  assert.equal(overlap(a, b), false);
});

test('dias diferentes, mesma hora: sem conflito', () => {
  const a = slot('2026-09-10', '09:00', '10:00');
  const b = slot('2026-09-11', '09:00', '10:00');
  assert.equal(overlap(a, b), false);
});

test('overlap é simétrica (overlap(A, B) === overlap(B, A))', () => {
  const a = slot('2026-09-10', '09:00', '10:00');
  const b = slot('2026-09-10', '09:45', '10:45');
  assert.equal(overlap(a, b), overlap(b, a));
});

test('blocos de durações diferentes: um bloco curto dentro de um longo é conflito', () => {
  const longo = slot('2026-09-10', '09:00', '12:00');
  const curto = slot('2026-09-10', '10:00', '10:15');
  assert.equal(overlap(longo, curto), true);
});

test('TimeSlot: rejeita datas inválidas e blocos em que o fim não é depois do início', () => {
  const valid = new Date('2026-09-10T09:00');
  assert.throws(() => new TimeSlot(new Date('lixo'), valid), RangeError);
  assert.throws(() => new TimeSlot(valid, new Date('lixo')), RangeError);
  assert.throws(() => new TimeSlot(valid, valid), RangeError);
  assert.throws(() => new TimeSlot(new Date('2026-09-10T10:00'), valid), RangeError);
});

test('TimeSlot: é imutável (Value Object)', () => {
  const slot = new TimeSlot(new Date('2026-09-10T09:00'), new Date('2026-09-10T10:00'));
  assert.throws(() => {
    slot.start = new Date('2000-01-01');
  }, TypeError);
  assert.equal(Object.isFrozen(slot), true);
});
