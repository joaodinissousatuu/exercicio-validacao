// Utilizador fixo da app (sem login) — ver SPEC.md §2. Usado tanto para o header
// X-User-Id (em apiFetch) como para os componentes saberem "qual é o meu convite".
export const FIXED_USER_ID = import.meta.env.VITE_FIXED_USER_ID;
export const FIXED_USER_NAME = import.meta.env.VITE_FIXED_USER_NAME;
