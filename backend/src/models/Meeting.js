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

export const Meeting = mongoose.model('Meeting', meetingSchema);
