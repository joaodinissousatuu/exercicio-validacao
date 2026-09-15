import { useMutation, useQueryClient } from '@tanstack/react-query';
import { respondToInvite } from '../api/meetings.js';

export function useRespondToInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, userId, status }) => respondToInvite(meetingId, userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}
