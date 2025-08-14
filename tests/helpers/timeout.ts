export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, rej) =>
    t = setTimeout(() => rej(new Error(`Timeout: ${label} after ${ms}ms`)), ms)
  );
  try { 
    return await Promise.race([p, timeout]); 
  } finally { 
    clearTimeout(t); 
  }
}