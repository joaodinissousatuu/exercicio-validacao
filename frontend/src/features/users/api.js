import { apiFetch } from '../../shared/apiFetch.js';

export const searchUsers = (q) => apiFetch(`/users?q=${encodeURIComponent(q)}`);
