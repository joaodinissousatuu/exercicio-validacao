import express from 'express';
import { User } from '../models/User.js';

export const usersRouter = express.Router();

// GET /users?q=texto — pesquisar utilizadores por username (case-insensitive, parcial).
// Sem q, devolve todos (a lista de utilizadores é pequena — sem paginação, fora do MVP).
usersRouter.get('/', async (req, res) => {
  const q = (req.query.q ?? '').trim();

  const filter = q ? { username: { $regex: q, $options: 'i' } } : {};
  const users = await User.find(filter);
  res.json(users);
});
