import { TimeSlot } from '../scheduling/TimeSlot.js';
import { Agenda } from '../scheduling/Agenda.js';
import { InviteStatus, isInviteResponse } from './InviteStatus.js';

/**
 * @typedef {Object} Participant
 * @property {string} userId - Referência ao User convidado.
 * @property {import('./InviteStatus.js').InviteStatusValue} status - Estado do convite deste participante (ver GLOSSARY.md: o convite não é uma entidade à parte, é este estado).
 */

/**
 * @typedef {Object} MeetingProps
 * @property {string} [_id] - Identificador (ausente antes de gravado pelo repositório).
 * @property {string} title - Título da reunião.
 * @property {string} description - Descrição da reunião.
 * @property {string} date - Data da reunião (formato 'YYYY-MM-DD').
 * @property {string} startTime - Hora de início (formato 'HH:mm'). Duração fixa de 1h, não é campo guardado.
 * @property {string} organizerId - Referência ao User que criou a reunião.
 * @property {ReadonlyArray<Participant>} participants - Lista de participantes, inclui o organizador (já aceite). É copiada pelo construtor.
 */

/**
 * Agregado de domínio, sem qualquer dependência de Mongoose ou de outra
 * tecnologia de persistência — meetingRepository.js é o único ficheiro que
 * sabe traduzir entre isto e o documento gravado na base de dados
 * (MeetingModel.js). Isolar assim a camada de Domínio da de Infraestrutura é
 * o próprio padrão Layered Architecture do capítulo 4 do livro do Evans.
 *
 * Comportamento do agregado: quem pode ver a reunião, qual o estado do
 * convite de alguém, e como responder a um convite. Vive aqui para que a
 * rota nunca mexa diretamente em `participants` de fora — só o próprio
 * agregado sabe como interpretar e alterar o seu estado interno.
 *
 * Fica deliberadamente de fora: decidir SE aceitar entra em conflito de
 * horário com outras reuniões. Essa regra cruza vários agregados Meeting ao
 * mesmo tempo (a candidata contra as já aceites de outras reuniões), e um
 * agregado não tem, sozinho, os dados para a decidir — quem decide é a
 * Agenda do utilizador (scheduling/Agenda.js), consultada pela rota antes
 * de invocar respondToInvite().
 *
 * Encapsulamento (SPEC.md §21): a reunião só muda através dos seus métodos. Os
 * campos não podem ser reatribuídos (o objeto é congelado), `participants` é uma
 * cópia só de leitura da lista interna, e o construtor copia a lista que recebe —
 * por isso as invariantes abaixo continuam verdadeiras depois da construção.
 *
 * Invariantes, verificadas no construtor (Assertions — ver SPEC.md §18):
 * - cada utilizador aparece no máximo uma vez em `participants`;
 * - o organizador é participante, com o convite aceite;
 * - todos os estados de convite são valores de InviteStatus.
 *
 * Termos (reunião, organizador, participante, convite, agenda, bloco de
 * tempo) seguem GLOSSARY.md.
 */

/**
 * Regra de Meetings, não de Scheduling: uma reunião ocupa sempre 1h a partir
 * da hora de início (ver SPEC.md §1). O Scheduling só recebe o bloco de tempo
 * já calculado e não sabe que esta duração existe.
 */
export const MEETING_DURATION_MINUTES = 60;

/** Data ou hora de início que não existe ou não está no formato YYYY-MM-DD / HH:mm. */
export class InvalidScheduleError extends Error {
  constructor() {
    super('Data ou hora inválida: usa o formato YYYY-MM-DD para a data e HH:mm para a hora.');
    this.name = 'InvalidScheduleError';
  }
}

/** Uma reunião construída com dados que violam as suas invariantes — erro de programação, não do utilizador. */
export class InvalidMeetingError extends Error {
  /** @param {string} reason */
  constructor(reason) {
    super(`Reunião inválida: ${reason}`);
    this.name = 'InvalidMeetingError';
  }
}

/** Resposta a um convite de quem não foi convidado para a reunião. */
export class NotInvitedError extends Error {
  constructor() {
    super('Não foste convidado para esta reunião.');
    this.name = 'NotInvitedError';
  }
}

/** O organizador está sempre aceite na própria reunião (SPEC.md §5). */
export class OrganizerCannotDeclineError extends Error {
  constructor() {
    super('O organizador não pode recusar a própria reunião.');
    this.name = 'OrganizerCannotDeclineError';
  }
}

const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Bloco de tempo ocupado por uma reunião com esta data e hora de início.
 * Função à parte (e não só o método timeSlot()) porque, ao criar uma reunião,
 * é preciso o bloco de tempo antes de o agregado existir.
 *
 * Valida a data e a hora antes de as converter: o Date do JavaScript devolve
 * uma data inválida para texto que não reconhece (o que fazia qualquer
 * comparação de conflito dar `false`), e corrige em silêncio datas que não
 * existem (2026-02-30 passaria a 2 de março).
 * @param {{ date: string, startTime: string }} schedule
 * @returns {TimeSlot}
 * @throws {InvalidScheduleError}
 */
export function meetingTimeSlot({ date, startTime }) {
  const dateParts = DATE_FORMAT.exec(String(date));
  if (!dateParts || !TIME_FORMAT.test(String(startTime))) {
    throw new InvalidScheduleError();
  }

  const start = new Date(`${date}T${startTime}`);
  const [, year, month, day] = dateParts.map(Number);
  const sameDay = start.getFullYear() === year && start.getMonth() + 1 === month && start.getDate() === day;
  if (!sameDay) {
    throw new InvalidScheduleError();
  }

  const end = new Date(start.getTime() + MEETING_DURATION_MINUTES * 60 * 1000);
  return new TimeSlot(start, end);
}

/**
 * Agenda de um utilizador a partir das reuniões que ele aceitou. Vive em
 * Meetings, não em Scheduling: é aqui que se sabe que uma reunião aceite é um
 * compromisso, e qual o bloco de tempo que ocupa.
 * @param {Meeting[]} acceptedMeetings
 * @returns {Agenda}
 */
export function agendaOf(acceptedMeetings) {
  return new Agenda(acceptedMeetings.map((m) => m.timeSlot()));
}

/** Extrai o id de uma referência, populada ou não (string crua ou objeto {_id, name, username}). */
function idOf(value) {
  return String(value?._id ?? value);
}

/**
 * Cópia imutável de um participante. Uma referência populada ({ _id, name, username },
 * um objeto simples) também é copiada e congelada; ids (strings, ObjectId) ficam como estão.
 */
function frozenParticipant({ userId, status }) {
  const isPlainObject = userId !== null && Object.getPrototypeOf(userId) === Object.prototype;
  return Object.freeze({ userId: isPlainObject ? Object.freeze({ ...userId }) : userId, status });
}

export class Meeting {
  /** @type {ReadonlyArray<Readonly<Participant>>} */
  #participants;

  /** @param {MeetingProps} props */
  constructor({ _id, title, description, date, startTime, organizerId, participants }) {
    this._id = _id;
    this.title = title;
    this.description = description;
    this.date = date;
    this.startTime = startTime;
    this.organizerId = organizerId;
    this.#participants = Object.freeze(participants.map(frozenParticipant));
    this.#assertInvariants();
    Object.freeze(this);
  }

  /** Lista de participantes, só de leitura. Muda-se com respondToInvite(). */
  get participants() {
    return this.#participants;
  }

  /**
   * Forma enviada pela API (JSON.stringify chama este método). Igual à de antes do
   * encapsulamento — os campos privados e os getters não seriam serializados sozinhos.
   */
  toJSON() {
    const { _id, title, description, date, startTime, organizerId } = this;
    return { _id, title, description, date, startTime, organizerId, participants: this.#participants };
  }

  #assertInvariants() {
    const ids = this.#participants.map((p) => idOf(p.userId));
    if (new Set(ids).size !== ids.length) {
      throw new InvalidMeetingError('um utilizador aparece mais do que uma vez nos participantes.');
    }
    const validStatuses = Object.values(InviteStatus);
    if (this.#participants.some((p) => !validStatuses.includes(p.status))) {
      throw new InvalidMeetingError('estado de convite desconhecido.');
    }
    if (this.inviteStatusOf(idOf(this.organizerId)) !== InviteStatus.ACCEPTED) {
      throw new InvalidMeetingError('o organizador tem de ser participante, com o convite aceite.');
    }
  }

  /** Bloco de tempo que esta reunião ocupa na agenda de quem a aceitou. */
  timeSlot() {
    return meetingTimeSlot(this);
  }

  /** @param {string} userId @returns {Readonly<Participant> | null} só de leitura */
  findParticipant(userId) {
    const target = String(userId);
    return this.#participants.find((p) => idOf(p.userId) === target) ?? null;
  }

  /** @param {string} userId */
  isOrganizer(userId) {
    return idOf(this.organizerId) === String(userId);
  }

  /** Organizador ou participante (convidado), independentemente do estado do convite. @param {string} userId */
  hasAccess(userId) {
    return this.isOrganizer(userId) || this.findParticipant(userId) !== null;
  }

  /** Ids dos participantes convidados pelo organizador (todos menos ele). @returns {string[]} */
  inviteeIds() {
    return this.#participants.map((p) => idOf(p.userId)).filter((id) => !this.isOrganizer(id));
  }

  /**
   * Estado do convite de um utilizador nesta reunião, ou null se não foi convidado.
   * @param {string} userId
   * @returns {import('./InviteStatus.js').InviteStatusValue | null}
   */
  inviteStatusOf(userId) {
    return this.findParticipant(userId)?.status ?? null;
  }

  /** A reunião conta para a agenda deste utilizador (ver GLOSSARY.md). @param {string} userId */
  isAcceptedBy(userId) {
    return this.inviteStatusOf(userId) === InviteStatus.ACCEPTED;
  }

  /** @param {string} userId */
  isPendingFor(userId) {
    return this.inviteStatusOf(userId) === InviteStatus.PENDING;
  }

  /**
   * Regista a resposta de um utilizador ao seu convite. Protege a invariante
   * que só este agregado consegue garantir — o organizador está sempre aceite
   * na própria reunião. O conflito de horário, que cruza várias reuniões, é
   * responsabilidade de quem chama, através da Agenda do utilizador.
   *
   * Comando puro: muda o estado e não devolve nada (para saber o resultado,
   * pergunta-se depois com inviteStatusOf()). Quando não pode cumprir, diz
   * porquê com um erro, em vez de devolver null em silêncio.
   * @param {string} userId
   * @param {'accepted' | 'declined'} status
   * @returns {void}
   * @throws {TypeError} se `status` não for uma resposta (aceitar ou recusar)
   * @throws {NotInvitedError}
   * @throws {OrganizerCannotDeclineError}
   */
  respondToInvite(userId, status) {
    if (!isInviteResponse(status)) {
      throw new TypeError(`Resposta a convite inválida: ${status}`);
    }
    const participant = this.findParticipant(userId);
    if (!participant) {
      throw new NotInvitedError();
    }
    if (status === InviteStatus.DECLINED && this.isOrganizer(userId)) {
      throw new OrganizerCannotDeclineError();
    }
    this.#participants = Object.freeze(
      this.#participants.map((p) => (p === participant ? frozenParticipant({ ...p, status }) : p)),
    );
  }
}
