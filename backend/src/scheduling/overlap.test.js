import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlap } from './overlap.js';

test('sem sobreposição: reuniões em horas separadas no mesmo dia', () => {
  const a = { date: '2026-09-10', startTime: '09:00' }; // 09:00 - 10:00
  const b = { date: '2026-09-10', startTime: '11:00' }; // 11:00 - 12:00
  assert.equal(overlap(a, b), false);
});

test('sobreposição total: mesma reunião exata', () => {
  const a = { date: '2026-09-10', startTime: '09:00' }; // 09:00 - 10:00
  const b = { date: '2026-09-10', startTime: '09:00' }; // 09:00 - 10:00
  assert.equal(overlap(a, b), true);
});

test('sobreposição parcial: B começa antes de A terminar', () => {
  const a = { date: '2026-09-10', startTime: '09:00' }; // 09:00 - 10:00
  const b = { date: '2026-09-10', startTime: '09:30' }; // 09:30 - 10:30
  assert.equal(overlap(a, b), true);
});

test('limite: A termina exatamente quando B começa não é conflito', () => {
  const a = { date: '2026-09-10', startTime: '09:00' }; // 09:00 - 10:00
  const b = { date: '2026-09-10', startTime: '10:00' }; // 10:00 - 11:00
  assert.equal(overlap(a, b), false);
});

test('dias diferentes, mesma hora: sem conflito', () => {
  const a = { date: '2026-09-10', startTime: '09:00' };
  const b = { date: '2026-09-11', startTime: '09:00' };
  assert.equal(overlap(a, b), false);
});

test('overlap é simétrica (overlap(A, B) === overlap(B, A))', () => {
  const a = { date: '2026-09-10', startTime: '09:00' };
  const b = { date: '2026-09-10', startTime: '09:45' };
  assert.equal(overlap(a, b), overlap(b, a));
});
