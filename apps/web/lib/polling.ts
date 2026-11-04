/** One request at a time; visibility resume runs a fresh read without changing the interval. */
export function startVisiblePolling(
  load: () => Promise<unknown>,
  ms: number,
  page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'> = document,
  timers: Pick<typeof globalThis, 'setInterval' | 'clearInterval'> = globalThis,
) {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (stopped || page.hidden || running) return;
    running = true;
    try {
      await load();
    } catch {
      /* caller owns error presentation */
    } finally {
      running = false;
    }
  };
  const visible = () => {
    if (!page.hidden) void tick();
  };
  void tick();
  const id = timers.setInterval(() => void tick(), ms);
  page.addEventListener('visibilitychange', visible);
  return () => {
    stopped = true;
    timers.clearInterval(id);
    page.removeEventListener('visibilitychange', visible);
  };
}
