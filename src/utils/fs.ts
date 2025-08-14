import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export function resolveFile(p: string) { return path.resolve(process.cwd(), p); }