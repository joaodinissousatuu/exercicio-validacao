import { useCallback, useEffect, useState } from 'react';
import { getMeeting } from '../api/meetings.js';

export function useMeeting(id) {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setMeeting(null);
    try {
      setMeeting(await getMeeting(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { meeting, loading, error, refetch };
}
