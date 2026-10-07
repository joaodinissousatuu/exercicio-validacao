import { MeetingModel } from './MeetingModel.js';
import { Meeting } from './Meeting.js';
import { isValidId } from '../shared/objectId.js';

/**
 * Esconde as queries Mongoose sobre a coleção de reuniões — as rotas falam
 * com este repositório, nunca diretamente com o modelo Meeting. É também o
 * único ficheiro que traduz entre o documento Mongoose (MeetingModel) e o
 * agregado de domínio (Meeting) — ver a nota em Meeting.js sobre Layered
 * Architecture.
 */

/**
 * Uma referência a User vem crua (ObjectId/string) ou populada
 * ({ _id, name, username }, via .populate()) — mantém-se a mesma forma que
 * a rota já esperava antes desta separação, só que agora explícita aqui.
 */
function refToDomain(value) {
  if (value && typeof value === 'object' && 'username' in value) {
    return { _id: String(value._id), name: value.name, username: value.username };
  }
  return String(value);
}

/** @param {import('./MeetingModel.js').MeetingModel} doc */
function toDomain(doc) {
  return new Meeting({
    _id: String(doc._id),
    title: doc.title,
    description: doc.description,
    date: doc.date,
    startTime: doc.startTime,
    organizerId: refToDomain(doc.organizerId),
    participants: doc.participants.map((p) => ({ userId: refToDomain(p.userId), status: p.status })),
  });
}

/**
 * Reuniões do utilizador — organizadas ou onde é participante, todos os estados.
 * @param {string} userId
 */
async function findForUser(userId) {
  const docs = await MeetingModel.find({
    $or: [{ organizerId: userId }, { 'participants.userId': userId }],
  }).sort({ date: 1, startTime: 1 });
  return docs.map(toDomain);
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
  const docs = await MeetingModel.find(filter);
  return docs.map(toDomain);
}

/** @param {string} id */
async function findById(id) {
  const doc = await MeetingModel.findById(id);
  return doc ? toDomain(doc) : null;
}

/** @param {string} id */
async function findByIdWithDetails(id) {
  const doc = await MeetingModel.findById(id)
    .populate('organizerId', 'name username')
    .populate('participants.userId', 'name username');
  return doc ? toDomain(doc) : null;
}

/**
 * @param {{ title: string, description: string, date: string, startTime: string, organizerId: any, participants: { userId: any, status: string }[] }} data
 */
async function create(data) {
  const doc = await MeetingModel.create(data);
  return toDomain(doc);
}

/**
 * Grava as alterações feitas a um agregado Meeting já existente. Hoje só
 * `participants[].status` muda depois da criação (via respondToInvite), por
 * isso é o único campo atualizado aqui.
 * @param {Meeting} meeting
 */
async function save(meeting) {
  await MeetingModel.updateOne({ _id: meeting._id }, { $set: { participants: meeting.participants } });
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
