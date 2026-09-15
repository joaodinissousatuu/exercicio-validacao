import express from 'express';
import { meetingRepository } from '../repositories/meetingRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { hasConflict } from '../domain/conflictService.js';
import { toRange } from '../utils/overlap.js';

export const meetingsRouter = express.Router();

// GET /meetings — reuniões do utilizador atual (organizadas + convidado, todos os estados).
// Cada reunião com o meu convite 'pending' vem com hasConflict: indica se aceitá-la
// entraria em conflito com outra reunião minha já aceite (mesma regra de domain/conflictService.js,
// única fonte de verdade — o frontend não reimplementa esta lógica).
meetingsRouter.get('/', async (req, res) => {
  const userId = String(req.currentUser._id);

  const meetings = await meetingRepository.findForUser(req.currentUser._id);

  const acceptedMeetings = meetings.filter((m) =>
    m.participants.some((p) => String(p.userId) === userId && p.status === 'accepted'),
  );

  const result = meetings.map((m) => {
    const myParticipant = m.participants.find((p) => String(p.userId) === userId);
    const isPending = myParticipant?.status === 'pending';
    const conflict = isPending ? hasConflict(m, acceptedMeetings, m._id) : false;

    return { ...m.toObject(), hasConflict: conflict };
  });

  res.json(result);
});

// POST /meetings — criar reunião; o organizador é o utilizador atual.
meetingsRouter.post('/', async (req, res) => {
  const { title, description, date, startTime, participantIds } = req.body;

  if (!title || !description || !date || !startTime) {
    return res.status(400).json({ error: 'title, description, date e startTime são obrigatórios.' });
  }

  if (toRange({ date, startTime }).start.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Data/hora da reunião não pode estar no passado.' });
  }

  const organizerId = req.currentUser._id;

  // O organizador fica automaticamente 'accepted' na própria reunião (ver SPEC.md,
  // Assunções), por isso a criação tem de ser verificada contra as reuniões já
  // aceites do organizador — senão o auto-accept contornava a regra de conflito.
  const organizerAcceptedMeetings = await meetingRepository.findAcceptedForUser(organizerId);
  if (hasConflict({ date, startTime }, organizerAcceptedMeetings)) {
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

  const currentUserId = String(req.currentUser._id);
  const isOrganizer = String(meeting.organizerId._id) === currentUserId;
  const isParticipant = meeting.participants.some((p) => String(p.userId._id) === currentUserId);

  if (!isOrganizer && !isParticipant) {
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

  const participant = meeting.participants.find((p) => String(p.userId) === userId);
  if (!participant) {
    return res.status(404).json({ error: 'Não foste convidado para esta reunião.' });
  }

  if (status === 'accepted') {
    const acceptedMeetings = await meetingRepository.findAcceptedForUser(userId, meeting._id);
    if (hasConflict(meeting, acceptedMeetings)) {
      return res.status(409).json({ error: 'Conflito de horário com outra reunião já aceite.' });
    }
  }

  participant.status = status;
  await meetingRepository.save(meeting);
  res.json(meeting);
});
