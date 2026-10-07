import mongoose from 'mongoose';

/**
 * Confirma que uma string tem o formato válido de um ObjectId do MongoDB.
 * Vive em shared/, não em users/ nem meetings/, por não ter vocabulário de
 * negócio — é usada de forma idêntica pelos dois repositórios de domínio.
 * @param {string} id
 * @returns {boolean}
 */
export function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}
