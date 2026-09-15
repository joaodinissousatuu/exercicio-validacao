import express from 'express';
import { userRepository } from '../repositories/userRepository.js';

export const usersRouter = express.Router();

// GET /users?q=texto — pesquisar utilizadores por username (case-insensitive, parcial).
// Sem q, devolve todos (a lista de utilizadores é pequena — sem paginação, fora do MVP).
usersRouter.get('/', async (req, res) => {
  const q = (req.query.q ?? '').trim();
  const users = await userRepository.search(q);
  res.json(users);
});
