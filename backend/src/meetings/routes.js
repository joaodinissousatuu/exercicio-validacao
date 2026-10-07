import express from 'express';
import { meetingRepository, ConcurrentModificationError } from './meetingRepository.js';
import { userRepository } from '../users/userRepository.js';
import { hasConflict } from '../scheduling/conflictService.js';
import { meetingTimeSlot, InvalidScheduleError, OrganizerCannotDeclineError } from './Meeting.js';

export const meetingsRouter = express.Router();

/** Blocos de tempo de uma agenda, na forma que o Scheduling entende. */
function slotsOf(agenda) {
  return agenda.map((m) => m.timeSlot());
}

// GET /meetings — reuniões do utilizador atual (organizadas + convidado, todos os estados).
// Cada reunião com o meu convite 'pending' vem com hasConflict: indica se aceitá-la
// entraria em conflito com a minha agenda (mesma regra de
// scheduling/conflictService.js, única fonte de verdade — o frontend não reimplementa esta lógica).
meetingsRouter.get('/', async (req, res) => {
  const userId = String(req.currentUser._id);

  const meetings = await meetingRepository.findForUser(req.currentUser._id);

  // "Quem está aceite" e "o meu convite está pendente" são perguntas sobre o
  // próprio agregado Meeting — pedimos-lhas a ele, em vez de ler `participants` daqui.
  // Uma reunião pendente nunca está na agenda, por isso não há nada a excluir.
  const agenda = slotsOf(meetings.filter((m) => m.isAcceptedBy(userId)));

  const result = meetings.map((m) => {
    const conflict = m.isPendingFor(userId) ? hasConflict(m.timeSlot(), agenda) : false;
    return { ...m, hasConflict: conflict };
  });

  res.json(result);
});

// POST /meetings — criar reunião; o organizador é o utilizador atual.
meetingsRouter.post('/', async (req, res) => {
  const { title, description, date, startTime, participantIds } = req.body;

  if (!title || !description || !date || !startTime) {
    return res.status(400).json({ error: 'title, description, date e startTime são obrigatórios.' });
  }

  let slot;
  try {
    slot = meetingTimeSlot({ date, startTime });
  } catch (err) {
    if (err instanceof InvalidScheduleError) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }

  if (slot.start.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Data/hora da reunião não pode estar no passado.' });
  }

  const organizerId = req.currentUser._id;

  // O organizador fica automaticamente 'accepted' na própria reunião (ver SPEC.md,
  // Assunções), por isso a criação tem de ser verificada contra a agenda do
  // organizador — senão o auto-accept contornava a regra de conflito.
  const organizerAgenda = await meetingRepository.findAgendaOf(organizerId);
  if (hasConflict(slot, slotsOf(organizerAgenda))) {
    return res.status(409).json({ error: 'Conflito de horário com outra reunião já aceite.' });
  }

  const requestedIds = Array.isArray(participantIds) ? participantIds : [];

  const invitedIds = [...new Set(requestedIds.map(String))].filter(
    (id) => id !== String(organizerId) && userRepository.isValidId(id),
  );

  const invitedUsers = await userRepository.findByIds(invitedIds);
  if (invitedUsers.length !== invitedIds.length) {
    return res.status(400).json({ error: 'Um ou mais participantes não existem.' });
  }

  const participants = [
    { userId: organizerId, status: 'accepted' },
    ...invitedIds.map((userId) => ({ userId, status: 'pending' })),
  ];

  const meeting = await meetingRepository.create({ title, description, date, startTime, organizerId, participants });
  res.status(201).json(meeting);
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

  if (status !== 'accepted' && status !== 'declined') {
    return res.status(400).json({ error: "status deve ser 'accepted' ou 'declined'." });
  }

  if (String(req.currentUser._id) !== userId) {
    return res.status(403).json({ error: 'Só podes responder ao teu próprio convite.' });
  }

  const meeting = await meetingRepository.findById(id);
  if (!meeting) {
    return res.status(404).json({ error: 'Reunião não encontrada.' });
  }

  if (!meeting.findParticipant(userId)) {
    return res.status(404).json({ error: 'Não foste convidado para esta reunião.' });
  }

  if (status === 'accepted') {
    const agenda = await meetingRepository.findAgendaOf(userId, meeting._id);
    if (hasConflict(meeting.timeSlot(), slotsOf(agenda))) {
      return res.status(409).json({ error: 'Conflito de horário com outra reunião já aceite.' });
    }
  }

  // O agregado é quem sabe gravar a resposta ao seu próprio convite — a rota
  // já não mexe em `participants` diretamente (ver Meeting.js).
  try {
    meeting.respondToInvite(userId, status);
    await meetingRepository.save(meeting);
  } catch (err) {
    if (err instanceof OrganizerCannotDeclineError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof ConcurrentModificationError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
  res.json(meeting);
});
