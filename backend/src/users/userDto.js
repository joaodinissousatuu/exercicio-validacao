/**
 * Forma de um utilizador nas respostas da API (Published Language, SPEC.md §13).
 * O domínio (User.js) não sabe como é enviado; é aqui, e só aqui, que isso se decide.
 * @param {import('./User.js').User} user
 * @returns {{ _id: string, name: string, username: string }}
 */
export function toUserDto(user) {
  return { _id: user._id, name: user.name, username: user.username };
}
