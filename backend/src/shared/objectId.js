import mongoose from 'mongoose';

/**
 * Confirma que uma string tem o formato válido de um ObjectId do MongoDB.
 * Vive na camada de repositórios (não em utils/ nem domain/) porque depende
 * do Mongoose — essas outras camadas foram deliberadamente desenhadas para
 * não conhecer detalhes de infraestrutura/base de dados.
 * @param {string} id
 * @returns {boolean}
 */
export function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}
