// Tipos para o que o middleware/currentUser.js acrescenta ao pedido do Express:
// a partir dele, todas as rotas têm o utilizador do X-User-Id em req.currentUser.
import type { User } from '../users/User.js';

declare global {
  namespace Express {
    interface Request {
      currentUser: User;
    }
  }
}

export {};
