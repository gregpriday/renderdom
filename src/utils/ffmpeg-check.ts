import { execa } from 'execa';

export async function checkFfmpegAvailability(): Promise<{ ffmpeg: boolean; ffprobe: boolean; errors: string[] }> {
  const errors: string[] = [];
  let ffmpegAvailable = false;
  let ffprobeAvailable = false;

  // Check FFmpeg
  try {
    await execa('ffmpeg', ['-version'], { timeout: 5000 });
    ffmpegAvailable = true;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      errors.push('FFmpeg not found in PATH. Install FFmpeg and ensure it\'s available in your system PATH.');
    } else {
      errors.push(`FFmpeg check failed: ${error.message}`);
    }
  }

  // Check FFprobe
  try {
    await execa('ffprobe', ['-version'], { timeout: 5000 });
    ffprobeAvailable = true;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      errors.push('FFprobe not found in PATH. FFprobe is typically included with FFmpeg installations.');
    } else {
      errors.push(`FFprobe check failed: ${error.message}`);
    }
  }

  return { ffmpeg: ffmpegAvailable, ffprobe: ffprobeAvailable, errors };
}

export function validateFfmpegRequirements(needsFFprobe = false): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const { ffmpeg, ffprobe, errors } = await checkFfmpegAvailability();
    
    if (!ffmpeg) {
      reject(new Error('FFmpeg is required but not available. ' + errors.join(' ')));
      return;
    }
    
    if (needsFFprobe && !ffprobe) {
      reject(new Error('FFprobe is required for audio processing but not available. ' + errors.join(' ')));
      return;
    }
    
    resolve();
  });
}