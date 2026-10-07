/**
 * Agenda de um utilizador (ver GLOSSARY.md): os blocos de tempo dos
 * compromissos que ele já aceitou. Decide a regra de negócio central do
 * exercício — se um compromisso candidato entra em conflito de horário com a
 * agenda (SPEC.md secção 4).
 *
 * Até à SPEC §18 esta regra vivia num serviço de domínio
 * (`conflictService.hasConflict(candidate, agenda)`), justificado por
 * "nenhum agregado tem, sozinho, a informação para decidir isto". Era
 * verdade para o agregado Meeting — mas o objeto que tem essa informação
 * existia no vocabulário (a agenda) e não no código. Dado esse nome, a regra
 * passa a ser comportamento dele, e o serviço deixa de ser preciso.
 *
 * Value Object, imutável. Não conhece HTTP, Mongoose nem o vocabulário de
 * Meetings — só blocos de tempo. Montar a agenda (que reuniões contam) é
 * responsabilidade de Meetings (ver agendaOf() em meetings/Meeting.js).
 */
export class Agenda {
  /** @param {import('./TimeSlot.js').TimeSlot[]} slots */
  constructor(slots) {
    this.slots = Object.freeze([...slots]);
    Object.freeze(this);
  }

  /**
   * Um compromisso candidato está em conflito quando o seu bloco de tempo se
   * sobrepõe a algum bloco da agenda.
   * @param {import('./TimeSlot.js').TimeSlot} candidate
   * @returns {boolean}
   */
  conflictsWith(candidate) {
    return this.slots.some((slot) => slot.overlaps(candidate));
  }
}
