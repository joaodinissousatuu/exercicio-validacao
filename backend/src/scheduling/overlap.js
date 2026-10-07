/**
 * Bloco de tempo (ver GLOSSARY.md): o período que um compromisso ocupa na
 * agenda de alguém, como intervalo semiaberto [start, end). Não sabe o que o
 * ocupa (uma reunião ou outra coisa) nem quanto dura por defeito — quem o
 * constrói é que decide isso (ver Meeting.timeSlot() em meetings/Meeting.js).
 *
 * Value Object: definido só pelos seus valores, imutável, e sempre válido —
 * o construtor recusa datas inválidas e blocos em que o fim não é depois do
 * início, por isso nenhum TimeSlot que chegue a overlap() pode fazer a
 * comparação devolver `false` por engano (com uma data inválida, `<` dá
 * sempre `false`, e um conflito real passaria despercebido).
 */
export class TimeSlot {
  /**
   * @param {Date} start
   * @param {Date} end
   */
  constructor(start, end) {
    if (!isValidDate(start) || !isValidDate(end)) {
      throw new RangeError('Bloco de tempo com data inválida.');
    }
    if (end <= start) {
      throw new RangeError('Bloco de tempo tem de terminar depois de começar.');
    }
    this.start = new Date(start);
    this.end = new Date(end);
    Object.freeze(this);
  }
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

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
