/** Integer-capacity bin packing. BFD provides a feasible incumbent, DFS proves a
 * minimum stock count when exhausted or when the volume lower bound is reached.
 * No claim is made about a secondary distribution of reusable offcuts. */
export function packStock(
  sizes: number[],
  capacity: number,
  budget: { nodes: number; deadline: number },
): { bins: number[][]; lowerBound: number; optimal: boolean; nodes: number } {
  const order = sizes
    .map((size, i) => ({ size, i }))
    .sort((a, b) => b.size - a.size || a.i - b.i);
  const initial: number[][] = [],
    initialUsed: number[] = [];
  for (const { size, i } of order) {
    let best = -1,
      space = Infinity;
    for (let j = 0; j < initial.length; j++) {
      const left = capacity - initialUsed[j]! - size;
      if (left >= 0 && left < space) {
        best = j;
        space = left;
      }
    }
    if (best < 0) {
      best = initial.length;
      initial.push([]);
      initialUsed.push(0);
    }
    initial[best]!.push(i);
    initialUsed[best]! += size;
  }
  const lowerBound = Math.max(
    Math.ceil(sizes.reduce((s, n) => s + n, 0) / capacity),
    order.filter((p) => p.size > capacity / 2).length,
  );
  let best = initial,
    nodes = 0,
    stopped = false;
  if (best.length === lowerBound)
    return { bins: best, lowerBound, optimal: true, nodes };
  // Large lists retain BFD and a lower bound without risking recursion depth.
  if (sizes.length > 100)
    return { bins: best, lowerBound, optimal: false, nodes };
  const bins: number[][] = [],
    used: number[] = [];
  const suffix = Array(order.length + 1).fill(0) as number[];
  for (let i = order.length - 1; i >= 0; i--)
    suffix[i] = suffix[i + 1]! + order[i]!.size;
  function visit(at: number): void {
    if (stopped || best.length === lowerBound) return;
    if (nodes >= budget.nodes || Date.now() >= budget.deadline) {
      stopped = true;
      return;
    }
    nodes++;
    if (at === order.length) {
      best = bins.map((b) => [...b]);
      return;
    }
    if (bins.length >= best.length) return;
    const free = used.reduce((n, u) => n + capacity - u, 0);
    if (
      bins.length + Math.ceil(Math.max(0, suffix[at]! - free) / capacity) >=
      best.length
    )
      return;
    const { size, i } = order[at]!;
    const seen = new Set<number>();
    for (let j = 0; j < bins.length; j++) {
      if (seen.has(used[j]!) || used[j]! + size > capacity) continue;
      seen.add(used[j]!);
      bins[j]!.push(i);
      used[j]! += size;
      visit(at + 1);
      used[j]! -= size;
      bins[j]!.pop();
      if (stopped || best.length === lowerBound) return;
    }
    if (bins.length + 1 < best.length) {
      bins.push([i]);
      used.push(size);
      visit(at + 1);
      bins.pop();
      used.pop();
    }
  }
  visit(0);
  return {
    bins: best,
    lowerBound,
    optimal: best.length === lowerBound || !stopped,
    nodes,
  };
}
