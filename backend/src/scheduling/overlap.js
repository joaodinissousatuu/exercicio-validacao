/**
 * @typedef {Object} TimeSlot
 * Bloco de tempo (ver GLOSSARY.md): o período que um compromisso ocupa na
 * agenda de alguém, como intervalo semiaberto [start, end). Não sabe o que o
 * ocupa (uma reunião ou outra coisa) nem quanto dura por defeito — quem o
 * constrói é que decide isso (ver Meeting.timeSlot() em meetings/Meeting.js).
 * @property {Date} start
 * @property {Date} end
 */

/**
 * Verifica se dois blocos de tempo se sobrepõem.
 * Sobreposição no limite (um termina exatamente quando o outro começa) não conta.
 * @param {TimeSlot} a
 * @param {TimeSlot} b
 * @returns {boolean}
 */
export function overlap(a, b) {
  return a.start < b.end && b.start < a.end;
}
