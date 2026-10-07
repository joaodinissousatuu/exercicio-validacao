import { MeetingModel } from './MeetingModel.js';
import { Meeting, agendaOf } from './Meeting.js';
import { InviteStatus } from './InviteStatus.js';
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

/** @param {InstanceType<typeof import('./MeetingModel.js').MeetingModel>} doc - documento Mongoose devolvido por uma query */
function toDomain(doc) {
  const meeting = new Meeting({
    _id: String(doc._id),
    title: doc.title,
    description: doc.description,
    date: doc.date,
    startTime: doc.startTime,
    organizerId: String(doc.organizerId),
    participants: doc.participants.map((p) => ({ userId: String(p.userId), status: p.status })),
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
 * Agenda de um utilizador: os blocos de tempo das reuniões que ele já aceitou
 * (ver GLOSSARY.md). A query é a tradução para MongoDB da mesma regra que
 * Meeting.isAcceptedBy() decide em memória — se uma mudar, a outra também.
 * Opcionalmente exclui uma reunião — usado ao aceitar um convite, para não
 * comparar a reunião consigo própria se o convite já estava aceite.
 * @param {string} userId
 * @param {string} [excludeMeetingId]
 * @returns {Promise<import('../scheduling/Agenda.js').Agenda>}
 */
async function findAgendaOf(userId, excludeMeetingId) {
  const filter = {
    participants: { $elemMatch: { userId, status: InviteStatus.ACCEPTED } },
  };
  if (excludeMeetingId) {
    filter._id = { $ne: excludeMeetingId };
  }
  const docs = await MeetingModel.find(filter);
  return agendaOf(docs.map(toDomain));
}

/**
 * A reunião com este id, ou null se não existir. Um id com formato inválido também dá
 * null: o formato dos ids (ObjectId do MongoDB) é um detalhe deste repositório, não algo
 * que as rotas tenham de validar (SPEC.md §25).
 * @param {string} id
 */
async function findById(id) {
  if (!isValidId(id)) return null;
  const doc = await MeetingModel.findById(id);
  return doc ? toDomain(doc) : null;
}

/**
 * Grava uma reunião nova. Recebe o agregado já construído — e por isso já
 * verificado pelas invariantes do construtor —, não dados soltos: nada que o
 * Meeting recuse chega à base de dados.
 * @param {Meeting} meeting - ainda sem `_id`
 * @returns {Promise<Meeting>} a mesma reunião, com o `_id` atribuído
 */
async function create(meeting) {
  const { title, description, date, startTime, organizerId, participants } = meeting;
  const doc = await MeetingModel.create({ title, description, date, startTime, organizerId, participants });
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

/**
 * Reuniões gravadas que o modelo atual já não aceita — por exemplo, data/hora
 * inválida (validada só desde a SPEC §17) ou o organizador sem o convite aceite
 * (invariante desde a §18). Uma só reunião assim faz falhar as listas de quem nela
 * participa, porque não se consegue construir o agregado. Só lê; não altera nada.
 * Usado por `npm run check-data` (src/check-data.js).
 * @returns {Promise<{ _id: string, title: string, reason: string }[]>}
 */
async function findInvalid() {
  const invalid = [];
  for await (const doc of MeetingModel.find().sort({ _id: 1 })) {
    try {
      toDomain(doc).timeSlot();
    } catch (err) {
      invalid.push({ _id: String(doc._id), title: doc.title, reason: err.message });
    }
  }
  return invalid;
}

export const meetingRepository = {
  findForUser,
  findAgendaOf,
  findById,
  create,
  save,
  findInvalid,
};
