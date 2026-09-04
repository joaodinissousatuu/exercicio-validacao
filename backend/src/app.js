import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { currentUser } from './middleware/currentUser.js';
import { usersRouter } from './routes/users.js';
import { meetingsRouter } from './routes/meetings.js';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(currentUser);

app.use('/users', usersRouter);
app.use('/meetings', meetingsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});
