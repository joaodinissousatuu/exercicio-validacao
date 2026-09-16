import { User } from '../models/User.js';
import { isValidId } from './objectId.js';

/**
 * Esconde as queries Mongoose sobre a coleção de utilizadores — as rotas
 * falam com este repositório, nunca diretamente com o modelo User.
 */

/**
 * Pesquisa utilizadores por username (case-insensitive, parcial).
 * Sem termo de pesquisa, devolve todos.
 * @param {string} query
 */
async function search(query) {
  const filter = query ? { username: { $regex: query, $options: 'i' } } : {};
  return User.find(filter);
}

/** @param {string[]} ids */
async function findByIds(ids) {
  return User.find({ _id: { $in: ids } });
}

export const userRepository = {
  isValidId,
  search,
  findByIds,
};
