import { useQuery } from '@tanstack/react-query';
import { getMeetings } from '../api/meetings.js';

export function useMeetings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meetings'],
    queryFn: getMeetings,
  });

  return { meetings: data ?? [], loading: isLoading, error: error?.message ?? null, refetch };
}
