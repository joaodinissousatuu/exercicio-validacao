import express from 'express';
import { userRepository } from './userRepository.js';
import { toUserDto } from './userDto.js';

export const usersRouter = express.Router();

// GET /users?q=texto — pesquisar utilizadores por username (case-insensitive, parcial).
// Sem q, devolve todos (a lista de utilizadores é pequena — sem paginação, fora do MVP).
// `q` só conta se for um texto simples: `?q=a&q=b` (lista) ou `?q[x]=a` (objeto) eram
// aceites pelo Express e faziam o `.trim()` rebentar com erro 500 (SPEC §24).
usersRouter.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const users = await userRepository.search(q);
  res.json(users.map(toUserDto));
});
