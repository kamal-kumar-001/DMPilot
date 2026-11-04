'use client';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiRequest } from './api-client';

/** In-memory per-user data only. Auth and payment writes remain uncached. */
export function useCreatorQuery<T>(path: string, staleTime = 30_000, pollMs?: number) {
  const { data: session, status } = useSession();
  const query = useQuery({
    queryKey: ['creator', session?.user?.id, path],
    enabled: status === 'authenticated' && Boolean(session?.user?.id),
    queryFn: async ({ signal }) => {
      try {
        return await apiRequest<T>(path, { signal });
      } catch (error) {
        // A session-change race must not strand the new identity's observer.
        // Old identity work is cancelled and must never be retried.
        if (
          !signal.aborted &&
          error instanceof Error &&
          error.message === 'Session changed while request was pending'
        )
          return apiRequest<T>(path, { signal });
        throw error;
      }
    },
    staleTime,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: pollMs || false,
    refetchIntervalInBackground: false,
  });
  return { ...query, loading: query.isPending };
}
