import { toUserDto } from '../users/userDto.js';

/**
 * Forma das reuniões nas respostas da API — a Published Language da SPEC.md §13,
 * agora escrita em código. O agregado Meeting não sabe como é enviado pela rede:
 * mudar o domínio não muda o contrato sem passar por aqui, e mudar o contrato não
 * obriga a mexer no domínio (SPEC.md §25).
 */

/**
 * Reunião com referências a utilizadores por id — resposta de POST /meetings e de
 * PATCH /meetings/:id/invites/:userId, e base de cada item de GET /meetings.
 * @param {import('./Meeting.js').Meeting} meeting
 */
export function toMeetingDto(meeting) {
  return {
    _id: meeting._id,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date,
    startTime: meeting.startTime,
    organizerId: meeting.organizerId,
    participants: meeting.participants.map((p) => ({ userId: p.userId, status: p.status })),
  };
}

/**
 * Item de GET /meetings: a reunião, mais o estado do convite de quem pede e o aviso de
 * conflito (calculados pela política de compromissos, não pelo frontend).
 * @param {import('./Meeting.js').Meeting} meeting
 * @param {{ myInviteStatus: string | null, hasConflict: boolean }} view
 */
export function toMeetingListItemDto(meeting, { myInviteStatus, hasConflict }) {
  return { ...toMeetingDto(meeting), myInviteStatus, hasConflict };
}

/**
 * Detalhe de GET /meetings/:id: organizador e participantes com nome e username, para
 * o ecrã de detalhe. Os utilizadores são carregados à parte (userRepository) e juntados
 * aqui — o módulo de reuniões já não lê a coleção de utilizadores (SPEC.md §25).
 * Um utilizador que já não exista aparece como `null`, como acontecia com o .populate().
 * @param {import('./Meeting.js').Meeting} meeting
 * @param {import('../users/User.js').User[]} users
 */
export function toMeetingDetailDto(meeting, users) {
  const byId = new Map(users.map((u) => [u._id, toUserDto(u)]));
  const userOf = (id) => byId.get(id) ?? null;
  return {
    ...toMeetingDto(meeting),
    organizerId: userOf(meeting.organizerId),
    participants: meeting.participants.map((p) => ({ userId: userOf(p.userId), status: p.status })),
  };
}
