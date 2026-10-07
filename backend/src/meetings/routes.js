import express from 'express';
import { meetingRepository, ConcurrentModificationError } from './meetingRepository.js';
import { userRepository } from '../users/userRepository.js';
import { agendaOf, InvalidScheduleError, NotInvitedError, OrganizerCannotDeclineError } from './Meeting.js';
import { isInviteResponse } from './InviteStatus.js';
import {
  scheduleMeeting,
  respondToInvite,
  wouldConflict,
  ScheduleConflictError,
  MeetingInPastError,
} from './commitmentPolicy.js';

// Serviço de Aplicação (SPEC.md §10): lê o pedido HTTP, vai buscar o que a política
// precisa aos repositórios, chama a política de compromissos (commitmentPolicy.js — o
// Core Domain, §19) e traduz o resultado para HTTP. Não decide nenhuma regra de negócio.

export const meetingsRouter = express.Router();

/** Erros de domínio → resposta HTTP. Qualquer outro erro segue para o handler de 500. */
const HTTP_STATUS_BY_ERROR = new Map([
  [InvalidScheduleError, 400],
  [MeetingInPastError, 400],
  [NotInvitedError, 404],
  [OrganizerCannotDeclineError, 403],
  [ScheduleConflictError, 409],
  [ConcurrentModificationError, 409],
]);

function sendDomainError(res, err) {
  for (const [ErrorType, status] of HTTP_STATUS_BY_ERROR) {
    if (err instanceof ErrorType) {
      return res.status(status).json({ error: err.message });
    }
  }
  throw err;
}

// GET /meetings — reuniões do utilizador atual (organizadas + convidado, todos os estados).
// Cada reunião vem com:
// - myInviteStatus: o estado do meu convite nesta reunião, para o frontend não ter de o
//   procurar em `participants` (era conhecimento do agregado duplicado no frontend);
// - hasConflict: se o meu convite está pendente, indica se aceitá-lo entraria em conflito
//   com a minha agenda (commitmentPolicy.wouldConflict, única fonte de verdade — o frontend
//   não reimplementa esta lógica).
meetingsRouter.get('/', async (req, res) => {
  const userId = String(req.currentUser._id);

  const meetings = await meetingRepository.findForUser(req.currentUser._id);

  // Uma reunião pendente nunca está na agenda, por isso não há nada a excluir.
  const agenda = agendaOf(meetings.filter((m) => m.isAcceptedBy(userId)));

  // toJSON(): o spread de um Meeting não copia `participants` (é privado, SPEC §21).
  const result = meetings.map((m) => ({
    ...m.toJSON(),
    myInviteStatus: m.inviteStatusOf(userId),
    hasConflict: wouldConflict(m, userId, agenda),
  }));

  res.json(result);
});

// POST /meetings — criar reunião; o organizador é o utilizador atual.
meetingsRouter.post('/', async (req, res) => {
  const { title, description, date, startTime, participantIds } = req.body;

  if (!title || !description || !date || !startTime) {
    return res.status(400).json({ error: 'title, description, date e startTime são obrigatórios.' });
  }

  const organizerId = String(req.currentUser._id);
  // Ids com formato inválido são ignorados (formato de ObjectId é detalhe de infraestrutura).
  const requestedIds = (Array.isArray(participantIds) ? participantIds : [])
    .map(String)
    .filter((id) => userRepository.isValidId(id));

  const organizerAgenda = await meetingRepository.findAgendaOf(organizerId);

  let meeting;
  try {
    meeting = scheduleMeeting(
      { title, description, date, startTime, organizerId, inviteeIds: requestedIds },
      organizerAgenda,
    );
  } catch (err) {
    return sendDomainError(res, err);
  }

  const inviteeIds = meeting.inviteeIds();
  const invitedUsers = await userRepository.findByIds(inviteeIds);
  if (invitedUsers.length !== inviteeIds.length) {
    return res.status(400).json({ error: 'Um ou mais participantes não existem.' });
  }

  res.status(201).json(await meetingRepository.create(meeting));
});

// GET /meetings/:id — detalhes, incluindo participantes e estado dos convites.
meetingsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!meetingRepository.isValidId(id)) {
    return res.status(404).json({ error: 'Reunião não encontrada.' });
  }

  const meeting = await meetingRepository.findByIdWithDetails(id);

  if (!meeting) {
    return res.status(404).json({ error: 'Reunião não encontrada.' });
  }

  if (!meeting.hasAccess(req.currentUser._id)) {
    return res.status(403).json({ error: 'Sem acesso a esta reunião.' });
  }

  res.json(meeting);
});

// PATCH /meetings/:id/invites/:userId — aceitar ou recusar um convite.
meetingsRouter.patch('/:id/invites/:userId', async (req, res) => {
  const { id, userId } = req.params;
  const { status } = req.body;

  if (!meetingRepository.isValidId(id) || !userRepository.isValidId(userId)) {
    return res.status(404).json({ error: 'Reunião ou utilizador não encontrado.' });
  }

  if (!isInviteResponse(status)) {
    return res.status(400).json({ error: "status deve ser 'accepted' ou 'declined'." });
  }

  if (String(req.currentUser._id) !== userId) {
    return res.status(403).json({ error: 'Só podes responder ao teu próprio convite.' });
  }

  const meeting = await meetingRepository.findById(id);
  if (!meeting) {
    return res.status(404).json({ error: 'Reunião não encontrada.' });
  }

  try {
    const agenda = await meetingRepository.findAgendaOf(userId, meeting._id);
    respondToInvite(meeting, userId, status, agenda);
    await meetingRepository.save(meeting);
  } catch (err) {
    return sendDomainError(res, err);
  }
  res.json(meeting);
});
