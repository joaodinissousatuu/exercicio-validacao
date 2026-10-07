import { Meeting, meetingTimeSlot, NotInvitedError } from './Meeting.js';
import { InviteStatus } from './InviteStatus.js';

/**
 * Política de compromissos — o Core Domain deste projeto (SPEC.md §19, e o
 * Domain Vision Statement da §11): ninguém assume, sem dar por isso, dois
 * compromissos que não podem coexistir na sua agenda.
 *
 * A matemática de saber se dois blocos de tempo se sobrepõem
 * (scheduling/TimeSlot.js) é um mecanismo genérico (Cohesive Mechanism). O que
 * é específico deste negócio é a política à volta dela: quando é que alguém
 * assume um compromisso, e o que conta para a agenda. Essa política estava
 * espalhada pelas rotas Express (meetings/routes.js); vive agora só aqui
 * (Segregated Core), sem HTTP nem base de dados, e é testada sem nenhum dos dois.
 *
 * As regras:
 * - criar uma reunião é um compromisso do organizador (fica aceite), por isso
 *   tem de caber na agenda dele;
 * - aceitar um convite é assumir um compromisso, por isso tem de caber na
 *   agenda de quem aceita;
 * - recusar nunca é bloqueado — liberta tempo, não o ocupa;
 * - só convites aceites contam para a agenda (ver agendaOf() e findAgendaOf()).
 */

/** Aceitar este compromisso entraria em conflito com a agenda de quem o assume. */
export class ScheduleConflictError extends Error {
  constructor() {
    super('Conflito de horário com outra reunião já aceite.');
    this.name = 'ScheduleConflictError';
  }
}

/** Data e hora de início de uma reunião nova já passaram. */
export class MeetingInPastError extends Error {
  constructor() {
    super('Data/hora da reunião não pode estar no passado.');
    this.name = 'MeetingInPastError';
  }
}

/**
 * Cria uma reunião nova (Factory): o organizador fica participante com o
 * convite aceite, e cada convidado com o convite pendente. O organizador não
 * se convida a si próprio, e ninguém é convidado duas vezes.
 *
 * @param {{ title: string, description: string, date: string, startTime: string, organizerId: string, inviteeIds: string[] }} request
 * @param {import('../scheduling/Agenda.js').Agenda} organizerAgenda - agenda atual do organizador
 * @param {number} [now] - instante atual, em ms (injetável para os testes)
 * @returns {Meeting} ainda por gravar
 * @throws {import('./Meeting.js').InvalidScheduleError} data ou hora inválida
 * @throws {MeetingInPastError}
 * @throws {ScheduleConflictError} não cabe na agenda do organizador
 */
export function scheduleMeeting(request, organizerAgenda, now = Date.now()) {
  const { title, description, date, startTime, organizerId, inviteeIds } = request;

  const slot = meetingTimeSlot({ date, startTime });
  if (slot.start.getTime() < now) {
    throw new MeetingInPastError();
  }
  if (organizerAgenda.conflictsWith(slot)) {
    throw new ScheduleConflictError();
  }

  const organizer = String(organizerId);
  const invitees = [...new Set(inviteeIds.map(String))].filter((id) => id !== organizer);
  return new Meeting({
    title,
    description,
    date,
    startTime,
    organizerId: organizer,
    participants: [
      { userId: organizer, status: InviteStatus.ACCEPTED },
      ...invitees.map((userId) => ({ userId, status: InviteStatus.PENDING })),
    ],
  });
}

/**
 * Responde ao convite de um utilizador. Aceitar só é permitido se a reunião
 * couber na agenda dele; recusar nunca é bloqueado. As restantes regras (ter
 * sido convidado, o organizador não poder recusar) são do agregado Meeting.
 *
 * @param {Meeting} meeting
 * @param {string} userId
 * @param {'accepted' | 'declined'} status
 * @param {import('../scheduling/Agenda.js').Agenda} agenda - agenda de quem responde, sem esta reunião
 * @returns {void}
 * @throws {NotInvitedError} verificado antes do conflito: quem não foi convidado não tem agenda a proteger aqui
 * @throws {ScheduleConflictError}
 */
export function respondToInvite(meeting, userId, status, agenda) {
  if (meeting.inviteStatusOf(userId) === null) {
    throw new NotInvitedError();
  }
  if (status === InviteStatus.ACCEPTED && agenda.conflictsWith(meeting.timeSlot())) {
    throw new ScheduleConflictError();
  }
  meeting.respondToInvite(userId, status);
}

/**
 * Aviso para a lista de reuniões: só faz sentido para um convite ainda por
 * responder — diz se aceitá-lo entraria em conflito com a agenda.
 *
 * @param {Meeting} meeting
 * @param {string} userId
 * @param {import('../scheduling/Agenda.js').Agenda} agenda - agenda de quem vê a lista
 * @returns {boolean}
 */
export function wouldConflict(meeting, userId, agenda) {
  return meeting.isPendingFor(userId) && agenda.conflictsWith(meeting.timeSlot());
}
