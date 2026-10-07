import { overlap } from './overlap.js';

/**
 * Serviço de domínio do domínio Scheduling: decide se um bloco de tempo
 * candidato entra em conflito de horário com a agenda de um utilizador — os
 * blocos de tempo dos compromissos que ele já aceitou (a regra de negócio
 * central do exercício — ver SPEC.md secção 4, e GLOSSARY.md para os termos).
 * Não conhece HTTP nem Mongoose, e deliberadamente também não conhece o
 * vocabulário de Meetings — recebe só `TimeSlot`s, sem ids, datas em texto
 * nem durações de reunião. É essa generalidade que o torna um domínio à
 * parte em vez de uma função interna de Meetings: a regra de conflito de
 * agenda não é sobre reuniões, é sobre qualquer compromisso que ocupe um
 * bloco de tempo de um utilizador — Meetings é hoje o único consumidor, mas
 * a lógica não sabe isso nem depende disso.
 *
 * Montar a agenda (que reuniões contam, e excluir a própria reunião ao
 * aceitar de novo um convite já aceite) é responsabilidade de quem chama —
 * isso é vocabulário de Meetings, não de Scheduling.
 *
 * @param {import('./overlap.js').TimeSlot} candidate - bloco de tempo do compromisso a validar
 * @param {import('./overlap.js').TimeSlot[]} agenda - blocos de tempo já aceites pelo mesmo utilizador
 * @returns {boolean}
 */
export function hasConflict(candidate, agenda) {
  return agenda.some((slot) => overlap(candidate, slot));
}
