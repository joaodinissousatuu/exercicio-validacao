import { UserModel } from './UserModel.js';
import { User } from './User.js';
import { isValidId } from '../shared/objectId.js';

/**
 * Esconde as queries Mongoose sobre a coleção de utilizadores — as rotas
 * falam com este repositório, nunca diretamente com o modelo User. É também
 * o único ficheiro que traduz entre o documento Mongoose (UserModel) e a
 * entidade de domínio (User) — ver a nota em Meeting.js sobre Layered
 * Architecture.
 */

/** @param {import('./UserModel.js').UserModel} doc */
function toDomain(doc) {
  return new User({ _id: String(doc._id), name: doc.name, username: doc.username });
}

/**
 * Pesquisa utilizadores por username (case-insensitive, parcial).
 * Sem termo de pesquisa, devolve todos.
 * @param {string} query
 */
async function search(query) {
  const filter = query ? { username: { $regex: query, $options: 'i' } } : {};
  const docs = await UserModel.find(filter);
  return docs.map(toDomain);
}

/** @param {string[]} ids */
async function findByIds(ids) {
  const docs = await UserModel.find({ _id: { $in: ids } });
  return docs.map(toDomain);
}

/** @param {string} id */
async function findById(id) {
  const doc = await UserModel.findById(id);
  return doc ? toDomain(doc) : null;
}

export const userRepository = {
  isValidId,
  search,
  findByIds,
  findById,
};
