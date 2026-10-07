import { userRepository } from '../users/userRepository.js';

/**
 * Lê o header X-User-Id, valida que corresponde a um utilizador existente
 * e disponibiliza-o em req.currentUser para as rotas seguintes.
 */
export async function currentUser(req, res, next) {
  const userId = req.header('X-User-Id');

  if (!userId || !userRepository.isValidId(userId)) {
    return res.status(401).json({ error: 'Header X-User-Id em falta ou inválido.' });
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return res.status(401).json({ error: 'Utilizador do X-User-Id não existe.' });
  }

  req.currentUser = user;
  next();
}
