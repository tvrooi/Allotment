/**
 * Send items in batches of at most `size`, one batch after another (an endpoint's limit), and
 * return every batch's result in order.
 */
export async function inBatches<T, R>(
  items: T[],
  size: number,
  send: (batch: T[]) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) results.push(await send(items.slice(i, i + size)));
  return results;
}
