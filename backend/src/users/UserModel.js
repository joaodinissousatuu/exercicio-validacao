import mongoose from 'mongoose';

/**
 * Schema Mongoose de User — persistência pura, sem comportamento de domínio.
 * Vive à parte de User.js (a entidade de domínio) para que esta última não
 * dependa do Mongoose; só userRepository.js importa este ficheiro.
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
});

export const UserModel = mongoose.model('User', userSchema);
