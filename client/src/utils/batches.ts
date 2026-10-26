/**
 * Send items in batches of at most `size`, one batch after another (an endpoint's limit). A failed
 * batch stops the rest, but what earlier batches did is kept: `results` holds each completed
 * batch's result in order, `sent` how many items they covered and `error` why it stopped.
 */
export async function inBatches<T, R>(
  items: T[],
  size: number,
  send: (batch: T[]) => Promise<R>,
): Promise<{ results: R[]; sent: number; error: Error | null }> {
  const results: R[] = [];
  let sent = 0;
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    try {
      results.push(await send(batch));
    } catch (e) {
      return { results, sent, error: e instanceof Error ? e : new Error(String(e)) };
    }
    sent += batch.length;
  }
  return { results, sent, error: null };
}
