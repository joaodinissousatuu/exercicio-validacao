import { overlap } from '../utils/overlap.js';

/**
 * Serviço de domínio: decide se uma reunião candidata entra em conflito de
 * horário com alguma reunião já aceite pelo mesmo utilizador (a regra de
 * negócio central do exercício — ver SPEC.md secção 4). Não conhece HTTP
 * nem Mongoose: recebe as reuniões já aceites e decide.
 *
 * Consolida a lógica que antes estava duplicada entre POST /meetings
 * (auto-accept do organizador) e PATCH /invites (aceitar um convite).
 *
 * @param {{ date: string, startTime: string }} candidate - reunião a validar
 * @param {{ date: string, startTime: string, _id?: any }[]} acceptedMeetings - reuniões já aceites do mesmo utilizador
 * @param {string | { toString(): string }} [excludeMeetingId] - ignora esta reunião na comparação (a própria, ao aceitar um convite)
 * @returns {boolean}
 */
export function hasConflict(candidate, acceptedMeetings, excludeMeetingId) {
  const excludeId = excludeMeetingId ? String(excludeMeetingId) : null;

  return acceptedMeetings.some(
    (other) => (!excludeId || String(other._id) !== excludeId) && overlap(candidate, other),
  );
}
