/** Browser-only, short-lived and single-flight. Never persisted or shared during SSR. */
export function createSessionTransport(now: () => number = Date.now) {
  let cached: { value: any; until: number } | undefined;
  let pending: Promise<any> | undefined;
  let generation = 0;
  return {
    clear() {
      generation++;
      cached = undefined;
      pending = undefined;
    },
    async get(load: () => Promise<any>) {
      if (cached && now() < cached.until) return cached.value;
      if (pending) return pending;
      const version = generation;
      const request = load()
        .then((value) => {
          if (version !== generation) throw new Error('Session changed while request was pending');
          cached = { value, until: now() + 30_000 };
          return value;
        })
        .finally(() => {
          if (pending === request) pending = undefined;
        });
      pending = request;
      return request;
    },
  };
}
