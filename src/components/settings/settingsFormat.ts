export function shortUid(id: string) {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
