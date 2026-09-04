import mongoose from 'mongoose';
import { User } from '../models/User.js';

/**
 * Lê o header X-User-Id, valida que corresponde a um utilizador existente
 * e disponibiliza-o em req.currentUser para as rotas seguintes.
 */
export async function currentUser(req, res, next) {
  const userId = req.header('X-User-Id');

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({ error: 'Header X-User-Id em falta ou inválido.' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(401).json({ error: 'Utilizador do X-User-Id não existe.' });
  }

  req.currentUser = user;
  next();
}
