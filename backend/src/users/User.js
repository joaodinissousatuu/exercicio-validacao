/**
 * @typedef {Object} UserProps
 * @property {string} [_id] - Identificador (ausente antes de gravado pelo repositório).
 * @property {string} name - Nome apresentado na UI.
 * @property {string} username - Identificador único, usado para pesquisa/identificação.
 */

/**
 * Entidade de domínio, sem qualquer dependência de Mongoose — userRepository.js
 * é o único ficheiro que sabe traduzir entre isto e o documento gravado na
 * base de dados (UserModel.js). Sem métodos de comportamento, de propósito:
 * um utilizador aqui é identidade pura, sem regras de negócio próprias.
 */
export class User {
  /** @param {UserProps} props */
  constructor({ _id, name, username }) {
    this._id = _id;
    this.name = name;
    this.username = username;
  }
}
