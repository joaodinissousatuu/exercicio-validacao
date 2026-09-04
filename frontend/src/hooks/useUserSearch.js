import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { searchUsers } from '../api/users.js';

export function useUserSearch(query) {
  const [debounced] = useDebouncedValue(query, 300);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // query vazia devolve todos os utilizadores (ver backend) — mostra sugestões
    // logo ao abrir o campo, sem ser preciso saber o username de cor.
    searchUsers(debounced)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return { users, loading, error };
}
