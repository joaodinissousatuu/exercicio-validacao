import { apiFetch } from './apiFetch.js';

export const searchUsers = (q) => apiFetch(`/users?q=${encodeURIComponent(q)}`);
