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
 * Outra pessoa gravou a mesma reunião entre o momento em que a lemos e o
 * momento em que a tentámos gravar. Quem chama deve pedir para repetir.
 */
export class ConcurrentModificationError extends Error {
  constructor() {
    super('A reunião foi alterada por outra pessoa entretanto. Tenta outra vez.');
    this.name = 'ConcurrentModificationError';
  }
}

/**
 * Versão (`__v` do documento Mongoose) com que cada agregado foi lido, para o
 * save() detetar gravações concorrentes (optimistic locking). Fica aqui, e
 * não como campo do Meeting, porque é um detalhe de persistência: o
 * agregado não precisa de saber que existe, e não aparece nas respostas da API.
 * @type {WeakMap<Meeting, number>}
 */
const loadedVersions = new WeakMap();

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

/** @param {InstanceType<typeof import('./MeetingModel.js').MeetingModel>} doc - documento Mongoose devolvido por uma query */
function toDomain(doc) {
  const meeting = new Meeting({
    _id: String(doc._id),
    title: doc.title,
    description: doc.description,
    date: doc.date,
    startTime: doc.startTime,
    organizerId: refToDomain(doc.organizerId),
    participants: doc.participants.map((p) => ({ userId: refToDomain(p.userId), status: p.status })),
  });
  loadedVersions.set(meeting, doc.__v ?? 0);
  return meeting;
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
 * Agenda de um utilizador: as reuniões que ele já aceitou (ver GLOSSARY.md).
 * Opcionalmente exclui uma reunião — usado ao aceitar um convite, para não
 * comparar a reunião consigo própria se o convite já estava aceite.
 * @param {string} userId
 * @param {string} [excludeMeetingId]
 */
async function findAgendaOf(userId, excludeMeetingId) {
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
 *
 * O agregado é gravado inteiro, por isso duas respostas em simultâneo à
 * mesma reunião apagavam-se uma à outra (a segunda gravava a lista de
 * participantes que tinha lido antes da primeira). Agora a gravação só
 * acontece se o documento ainda estiver na versão em que foi lido; se outra
 * pessoa gravou entretanto, nada é gravado e lança ConcurrentModificationError.
 * @param {Meeting} meeting - tem de ter sido lido por este repositório
 * @throws {ConcurrentModificationError}
 */
async function save(meeting) {
  const version = loadedVersions.get(meeting);
  if (version === undefined) {
    throw new Error('save() recebeu um Meeting que não foi lido por este repositório.');
  }

  // Um documento gravado sem `__v` (fora do Mongoose) conta como versão 0.
  const versionFilter = version === 0 ? { $in: [0, null] } : version;
  const result = await MeetingModel.updateOne(
    { _id: meeting._id, __v: versionFilter },
    { $set: { participants: meeting.participants }, $inc: { __v: 1 } },
  );
  if (result.matchedCount === 0) {
    throw new ConcurrentModificationError();
  }
  loadedVersions.set(meeting, version + 1);
}

export const meetingRepository = {
  isValidId,
  findForUser,
  findAgendaOf,
  findById,
  findByIdWithDetails,
  create,
  save,
};
