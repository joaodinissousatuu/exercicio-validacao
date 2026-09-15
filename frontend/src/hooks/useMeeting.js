import { useQuery } from '@tanstack/react-query';
import { getMeeting } from '../api/meetings.js';

export function useMeeting(id) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => getMeeting(id),
    enabled: !!id,
  });

  return { meeting: data ?? null, loading: isLoading, error: error?.message ?? null, refetch };
}
