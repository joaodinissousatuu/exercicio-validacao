import express from 'express';
import mongoose from 'mongoose';
import { Meeting } from '../models/Meeting.js';
import { User } from '../models/User.js';
import { overlap, toRange } from '../utils/overlap.js';

export const meetingsRouter = express.Router();

// GET /meetings — reuniões do utilizador atual (organizadas + convidado, todos os estados).
// Cada reunião com o meu convite 'pending' vem com hasConflict: indica se aceitá-la
// entraria em conflito com outra reunião minha já aceite (mesma regra de utils/overlap.js,
// única fonte de verdade — o frontend não reimplementa esta lógica).
meetingsRouter.get('/', async (req, res) => {
  const userId = String(req.currentUser._id);

  const meetings = await Meeting.find({
    $or: [{ organizerId: req.currentUser._id }, { 'participants.userId': req.currentUser._id }],
  }).sort({ date: 1, startTime: 1 });

  const acceptedMeetings = meetings.filter((m) =>
    m.participants.some((p) => String(p.userId) === userId && p.status === 'accepted'),
  );

  const result = meetings.map((m) => {
    const myParticipant = m.participants.find((p) => String(p.userId) === userId);
    const isPending = myParticipant?.status === 'pending';
    const hasConflict = isPending
      ? acceptedMeetings.some((other) => String(other._id) !== String(m._id) && overlap(m, other))
      : false;

    return { ...m.toObject(), hasConflict };
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
  const organizerAcceptedMeetings = await Meeting.find({
    participants: { $elemMatch: { userId: organizerId, status: 'accepted' } },
  });
  const hasOrganizerConflict = organizerAcceptedMeetings.some((other) => overlap({ date, startTime }, other));
  if (hasOrganizerConflict) {
    return res.status(409).json({ error: 'Conflito de horário com outra reunião já aceite.' });
  }

  const requestedIds = Array.isArray(participantIds) ? participantIds : [];

  const invitedIds = [...new Set(requestedIds.map(String))].filter(
    (id) => id !== String(organizerId) && mongoose.Types.ObjectId.isValid(id),
  );

  const invitedUsers = await User.find({ _id: { $in: invitedIds } });
  if (invitedUsers.length !== invitedIds.length) {
    return res.status(400).json({ error: 'Um ou mais participantes não existem.' });
  }

  const participants = [
    { userId: organizerId, status: 'accepted' },
    ...invitedIds.map((userId) => ({ userId, status: 'pending' })),
  ];

  const meeting = await Meeting.create({ title, description, date, startTime, organizerId, participants });
  res.status(201).json(meeting);
});

// GET /meetings/:id — detalhes, incluindo participantes e estado dos convites.
meetingsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: 'Reunião não encontrada.' });
  }

  const meeting = await Meeting.findById(id)
    .populate('organizerId', 'name username')
    .populate('participants.userId', 'name username');

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

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(404).json({ error: 'Reunião ou utilizador não encontrado.' });
  }

  if (status !== 'accepted' && status !== 'declined') {
    return res.status(400).json({ error: "status deve ser 'accepted' ou 'declined'." });
  }

  if (String(req.currentUser._id) !== userId) {
    return res.status(403).json({ error: 'Só podes responder ao teu próprio convite.' });
  }

  const meeting = await Meeting.findById(id);
  if (!meeting) {
    return res.status(404).json({ error: 'Reunião não encontrada.' });
  }

  const participant = meeting.participants.find((p) => String(p.userId) === userId);
  if (!participant) {
    return res.status(404).json({ error: 'Não foste convidado para esta reunião.' });
  }

  if (status === 'accepted') {
    const acceptedMeetings = await Meeting.find({
      _id: { $ne: meeting._id },
      participants: { $elemMatch: { userId, status: 'accepted' } },
    });

    const hasConflict = acceptedMeetings.some((other) => overlap(meeting, other));
    if (hasConflict) {
      return res.status(409).json({ error: 'Conflito de horário com outra reunião já aceite.' });
    }
  }

  participant.status = status;
  await meeting.save();
  res.json(meeting);
});
