import mongoose from 'mongoose';

/**
 * @typedef {Object} Participant
 * @property {string} userId - Referência ao User convidado.
 * @property {'pending' | 'accepted' | 'declined'} status - Estado do convite.
 */

/**
 * @typedef {Object} Meeting
 * @property {string} title - Título da reunião.
 * @property {string} description - Descrição da reunião.
 * @property {string} date - Data da reunião (formato 'YYYY-MM-DD').
 * @property {string} startTime - Hora de início (formato 'HH:mm'). Duração fixa de 1h, não é campo guardado.
 * @property {string} organizerId - Referência ao User que criou a reunião.
 * @property {Participant[]} participants - Lista de participantes, inclui o organizador (já aceite).
 */

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      required: true,
    },
  },
  { _id: false },
);

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: {
    type: [participantSchema],
    required: true,
  },
});

/**
 * Comportamento do agregado Meeting: quem pode ver a reunião, qual o estado
 * do convite de alguém, e como responder a um convite. Vive aqui para que a
 * rota nunca mexa diretamente em `participants` de fora — só o próprio
 * agregado sabe como interpretar e alterar o seu estado interno.
 *
 * Fica deliberadamente de fora: decidir SE aceitar entra em conflito de
 * horário com outras reuniões. Essa regra cruza vários agregados Meeting ao
 * mesmo tempo (a candidata contra as já aceites de outras reuniões), e um
 * agregado não tem, sozinho, os dados para a decidir — por isso continua no
 * serviço de domínio scheduling/conflictService.js, chamado pela rota antes
 * de invocar respondToInvite().
 */

/** Extrai o id de uma referência, populada ou não (ObjectId cru ou documento populado). */
function idOf(value) {
  return String(value?._id ?? value);
}

/** @param {string} userId @returns {Participant | null} */
meetingSchema.methods.findParticipant = function (userId) {
  const target = String(userId);
  return this.participants.find((p) => idOf(p.userId) === target) ?? null;
};

/** @param {string} userId */
meetingSchema.methods.isOrganizer = function (userId) {
  return idOf(this.organizerId) === String(userId);
};

/** Organizador ou participante (convidado), independentemente do estado do convite. @param {string} userId */
meetingSchema.methods.hasAccess = function (userId) {
  return this.isOrganizer(userId) || this.findParticipant(userId) !== null;
};

/** @param {string} userId */
meetingSchema.methods.isAcceptedBy = function (userId) {
  return this.findParticipant(userId)?.status === 'accepted';
};

/** @param {string} userId */
meetingSchema.methods.isPendingFor = function (userId) {
  return this.findParticipant(userId)?.status === 'pending';
};

/**
 * Regista a resposta de um utilizador ao seu convite. Só muda o estado —
 * quem decide se pode fazê-lo (conflito de horário) é responsabilidade de
 * quem chama, através do serviço de domínio scheduling, não deste método.
 * @param {string} userId
 * @param {'accepted' | 'declined'} status
 * @returns {Participant | null} o participante atualizado, ou null se o utilizador não foi convidado
 */
meetingSchema.methods.respondToInvite = function (userId, status) {
  const participant = this.findParticipant(userId);
  if (!participant) return null;
  participant.status = status;
  return participant;
};

export const Meeting = mongoose.model('Meeting', meetingSchema);
