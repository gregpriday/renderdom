import { execa } from 'execa';

export async function probeAudioDurationMs(file: string): Promise<number> {
  // Uses container duration; robust for mp3/wav
  const { stdout } = await execa('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file
  ]);
  const seconds = parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not read audio duration from ${file}`);
  }
  return seconds * 1000;
}