import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { searchUsers } from '../api/users.js';

export function useUserSearch(query) {
  const [debounced] = useDebouncedValue(query, 300);

  // query vazia devolve todos os utilizadores (ver backend) — mostra sugestões
  // logo ao abrir o campo, sem ser preciso saber o username de cor.
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', debounced],
    queryFn: () => searchUsers(debounced),
  });

  return { users: data ?? [], loading: isLoading, error: error?.message ?? null };
}
