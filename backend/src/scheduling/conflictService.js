import { overlap } from './overlap.js';

/**
 * Serviço de domínio do domínio Scheduling: decide se um bloco de tempo
 * candidato entra em conflito de horário com algum bloco já aceite pelo
 * mesmo utilizador (a regra de negócio central do exercício — ver SPEC.md
 * secção 4). Não conhece HTTP nem Mongoose, e deliberadamente também não
 * conhece o vocabulário de Meetings — trabalha sobre `{ date, startTime }`
 * genéricos, não sobre "reuniões". É essa generalidade que o torna um
 * domínio à parte em vez de uma função interna de Meetings: a regra de
 * conflito de agenda não é sobre reuniões, é sobre qualquer coisa que
 * ocupe um período de tempo de um utilizador — Meetings é hoje o único
 * consumidor, mas a lógica não sabe isso nem depende disso.
 *
 * Consolida a lógica que antes estava duplicada entre POST /meetings
 * (auto-accept do organizador) e PATCH /invites (aceitar um convite).
 * Cruza dados de vários agregados `Meeting` ao mesmo tempo (a candidata
 * contra a lista de já aceites) — por isso vive num serviço de domínio,
 * não como método de instância de um `Meeting`: nenhum agregado individual
 * tem, sozinho, a informação para decidir isto.
 *
 * @param {{ date: string, startTime: string }} candidate - bloco de tempo a validar
 * @param {{ date: string, startTime: string, _id?: any }[]} acceptedMeetings - blocos já aceites do mesmo utilizador
 * @param {string | { toString(): string }} [excludeMeetingId] - ignora este bloco na comparação (o próprio, ao aceitar um convite)
 * @returns {boolean}
 */
export function hasConflict(candidate, acceptedMeetings, excludeMeetingId) {
  const excludeId = excludeMeetingId ? String(excludeMeetingId) : null;

  return acceptedMeetings.some(
    (other) => (!excludeId || String(other._id) !== excludeId) && overlap(candidate, other),
  );
}
