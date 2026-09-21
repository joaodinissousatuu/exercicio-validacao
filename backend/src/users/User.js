import mongoose from 'mongoose';

/**
 * @typedef {Object} User
 * @property {string} name - Nome apresentado na UI.
 * @property {string} username - Identificador único, usado para pesquisa/identificação.
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

export const User = mongoose.model('User', userSchema);
