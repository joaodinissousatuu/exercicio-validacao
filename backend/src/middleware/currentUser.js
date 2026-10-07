import { userRepository } from '../users/userRepository.js';

/**
 * Lê o header X-User-Id, valida que corresponde a um utilizador existente
 * e disponibiliza-o em req.currentUser para as rotas seguintes.
 */
export async function currentUser(req, res, next) {
  const userId = req.header('X-User-Id');

  if (!userId) {
    return res.status(401).json({ error: 'Header X-User-Id em falta ou inválido.' });
  }

  // Um id com formato inválido também não corresponde a ninguém (findById devolve null).
  const user = await userRepository.findById(userId);
  if (!user) {
    return res.status(401).json({ error: 'Utilizador do X-User-Id não existe.' });
  }

  req.currentUser = user;
  next();
}
