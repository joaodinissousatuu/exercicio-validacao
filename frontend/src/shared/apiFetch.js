const API_URL = import.meta.env.VITE_API_URL;
const FIXED_USER_ID = import.meta.env.VITE_FIXED_USER_ID;

/**
 * Wrapper único à volta de fetch(): junta a base da API, o header X-User-Id
 * (utilizador fixo, sem login — ver SPEC.md) e trata a resposta JSON.
 * Se o pedido falhar, lança um Error com a mensagem que o próprio backend devolveu.
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': FIXED_USER_ID,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? `Erro ${res.status} ao contactar o servidor.`);
  }

  return data;
}
