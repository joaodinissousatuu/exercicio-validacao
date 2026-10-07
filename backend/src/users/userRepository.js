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

/** @param {InstanceType<typeof import('./UserModel.js').UserModel>} doc - documento Mongoose devolvido por uma query */
function toDomain(doc) {
  return new User({ _id: String(doc._id), name: doc.name, username: doc.username });
}

/** Escapa os caracteres com significado especial numa expressão regular. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pesquisa utilizadores por username (case-insensitive, parcial).
 * Sem termo de pesquisa, devolve todos.
 *
 * O texto é procurado tal como foi escrito: é escapado antes de ir para o $regex,
 * porque passá-lo direto fazia `(` ou `[` dar erro 500, `.` encontrar qualquer
 * carácter, e permitia padrões que deixam a base de dados lenta (ReDoS).
 * @param {string} query
 */
async function search(query) {
  const filter = query ? { username: { $regex: escapeRegExp(query), $options: 'i' } } : {};
  const docs = await UserModel.find(filter);
  return docs.map(toDomain);
}

/**
 * Os utilizadores que existem com estes ids. Ids com formato inválido não correspondem a
 * ninguém e são simplesmente ignorados (o formato é um detalhe deste repositório).
 * @param {string[]} ids
 */
async function findByIds(ids) {
  const docs = await UserModel.find({ _id: { $in: ids.filter(isValidId) } });
  return docs.map(toDomain);
}

/**
 * O utilizador com este id, ou null se não existir (incluindo ids com formato inválido).
 * @param {string} id
 */
async function findById(id) {
  if (!isValidId(id)) return null;
  const doc = await UserModel.findById(id);
  return doc ? toDomain(doc) : null;
}

export const userRepository = {
  search,
  findByIds,
  findById,
};
