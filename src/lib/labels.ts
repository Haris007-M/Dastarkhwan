// First dine-in round is "Order", later dine-in rounds are "Add-on 1, 2...". Takeaway and delivery rounds are named by their type.
export function labelRows<T>(rows: T[], type: (r: T) => string): string[] {
  let dine = 0; const seen: Record<string, number> = {};
  return rows.map((r) => { const t = type(r); if (t === "Dine-in") return dine++ === 0 ? "Order" : `Add-on ${dine - 1}`; seen[t] = (seen[t] ?? 0) + 1; return seen[t] > 1 ? `${t} ${seen[t]}` : t; });
}
