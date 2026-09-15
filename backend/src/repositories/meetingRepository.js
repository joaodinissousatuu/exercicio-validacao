import { Meeting } from '../models/Meeting.js';
import { isValidId } from './objectId.js';

/**
 * Esconde as queries Mongoose sobre a coleção de reuniões — as rotas falam
 * com este repositório, nunca diretamente com o modelo Meeting.
 */

/**
 * Reuniões do utilizador — organizadas ou onde é participante, todos os estados.
 * @param {string} userId
 */
async function findForUser(userId) {
  return Meeting.find({
    $or: [{ organizerId: userId }, { 'participants.userId': userId }],
  }).sort({ date: 1, startTime: 1 });
}

/**
 * Reuniões já aceites por um utilizador, opcionalmente excluindo uma reunião
 * (usado ao aceitar um convite, para não comparar a reunião consigo própria).
 * @param {string} userId
 * @param {string} [excludeMeetingId]
 */
async function findAcceptedForUser(userId, excludeMeetingId) {
  const filter = {
    participants: { $elemMatch: { userId, status: 'accepted' } },
  };
  if (excludeMeetingId) {
    filter._id = { $ne: excludeMeetingId };
  }
  return Meeting.find(filter);
}

/** @param {string} id */
async function findById(id) {
  return Meeting.findById(id);
}

/** @param {string} id */
async function findByIdWithDetails(id) {
  return Meeting.findById(id)
    .populate('organizerId', 'name username')
    .populate('participants.userId', 'name username');
}

/**
 * @param {{ title: string, description: string, date: string, startTime: string, organizerId: any, participants: { userId: any, status: string }[] }} data
 */
async function create(data) {
  return Meeting.create(data);
}

/** @param {import('mongoose').Document} meeting */
async function save(meeting) {
  return meeting.save();
}

export const meetingRepository = {
  isValidId,
  findForUser,
  findAcceptedForUser,
  findById,
  findByIdWithDetails,
  create,
  save,
};
