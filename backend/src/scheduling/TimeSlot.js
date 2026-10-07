/**
 * Bloco de tempo (ver GLOSSARY.md): o período que um compromisso ocupa na
 * agenda de alguém, como intervalo semiaberto [start, end). Não sabe o que o
 * ocupa (uma reunião ou outra coisa) nem quanto dura por defeito — quem o
 * constrói é que decide isso (ver Meeting.timeSlot() em meetings/Meeting.js).
 *
 * Value Object: definido só pelos seus valores, imutável, e sempre válido —
 * o construtor recusa datas inválidas e blocos em que o fim não é depois do
 * início, por isso overlaps() nunca devolve `false` por engano (com uma data
 * inválida, `<` dá sempre `false`, e um conflito real passaria despercebido).
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

  /**
   * Verifica se este bloco de tempo se sobrepõe a outro. Operação fechada
   * sobre TimeSlot (Closure of Operations): recebe um bloco de tempo e não
   * precisa de mais nada. Sobreposição no limite (um termina exatamente
   * quando o outro começa) não conta.
   * @param {TimeSlot} other
   * @returns {boolean}
   */
  overlaps(other) {
    return this.start < other.end && other.start < this.end;
  }
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
