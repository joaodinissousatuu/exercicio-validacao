import mongoose from 'mongoose';
import { InviteStatus } from './InviteStatus.js';

/**
 * Schema Mongoose de Meeting — persistência pura, sem comportamento de domínio.
 * Vive à parte de Meeting.js (o agregado de domínio) para que este último não
 * dependa do Mongoose; só meetingRepository.js importa este ficheiro.
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
      enum: Object.values(InviteStatus),
      default: InviteStatus.PENDING,
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

export const MeetingModel = mongoose.model('Meeting', meetingSchema);
