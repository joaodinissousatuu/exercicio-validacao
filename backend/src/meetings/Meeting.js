import { TimeSlot } from '../scheduling/overlap.js';

/**
 * @typedef {Object} Participant
 * @property {string} userId - Referência ao User convidado.
 * @property {'pending' | 'accepted' | 'declined'} status - Estado do convite deste participante (ver GLOSSARY.md: o convite não é uma entidade à parte, é este estado).
 */

/**
 * @typedef {Object} MeetingProps
 * @property {string} [_id] - Identificador (ausente antes de gravado pelo repositório).
 * @property {string} title - Título da reunião.
 * @property {string} description - Descrição da reunião.
 * @property {string} date - Data da reunião (formato 'YYYY-MM-DD').
 * @property {string} startTime - Hora de início (formato 'HH:mm'). Duração fixa de 1h, não é campo guardado.
 * @property {string} organizerId - Referência ao User que criou a reunião.
 * @property {Participant[]} participants - Lista de participantes, inclui o organizador (já aceite).
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
 * agregado não tem, sozinho, os dados para a decidir — por isso continua no
 * serviço de domínio scheduling/conflictService.js, chamado pela rota antes
 * de invocar respondToInvite().
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

/** Extrai o id de uma referência, populada ou não (string crua ou objeto {_id, name, username}). */
function idOf(value) {
  return String(value?._id ?? value);
}

export class Meeting {
  /** @param {MeetingProps} props */
  constructor({ _id, title, description, date, startTime, organizerId, participants }) {
    this._id = _id;
    this.title = title;
    this.description = description;
    this.date = date;
    this.startTime = startTime;
    this.organizerId = organizerId;
    this.participants = participants;
  }

  /** Bloco de tempo que esta reunião ocupa na agenda de quem a aceitou. */
  timeSlot() {
    return meetingTimeSlot(this);
  }

  /** @param {string} userId @returns {Participant | null} */
  findParticipant(userId) {
    const target = String(userId);
    return this.participants.find((p) => idOf(p.userId) === target) ?? null;
  }

  /** @param {string} userId */
  isOrganizer(userId) {
    return idOf(this.organizerId) === String(userId);
  }

  /** Organizador ou participante (convidado), independentemente do estado do convite. @param {string} userId */
  hasAccess(userId) {
    return this.isOrganizer(userId) || this.findParticipant(userId) !== null;
  }

  /** @param {string} userId */
  isAcceptedBy(userId) {
    return this.findParticipant(userId)?.status === 'accepted';
  }

  /** @param {string} userId */
  isPendingFor(userId) {
    return this.findParticipant(userId)?.status === 'pending';
  }

  /**
   * Regista a resposta de um utilizador ao seu convite. Protege a invariante
   * que só este agregado consegue garantir — o organizador está sempre aceite
   * na própria reunião. O conflito de horário, que cruza várias reuniões, é
   * responsabilidade de quem chama, através do serviço de domínio scheduling.
   * @param {string} userId
   * @param {'accepted' | 'declined'} status
   * @returns {Participant | null} o participante atualizado, ou null se o utilizador não foi convidado
   * @throws {OrganizerCannotDeclineError}
   */
  respondToInvite(userId, status) {
    const participant = this.findParticipant(userId);
    if (!participant) return null;
    if (status === 'declined' && this.isOrganizer(userId)) {
      throw new OrganizerCannotDeclineError();
    }
    participant.status = status;
    return participant;
  }
}
