export const clamp = (n: number, a: number, b: number) => {
  if (Number.isNaN(n) || Number.isNaN(a) || Number.isNaN(b)) {
    return NaN;
  }
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return Math.min(Math.max(n, min), max);
};