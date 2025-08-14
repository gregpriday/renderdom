import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, 'out.mp4');
const adapter = path.join(__dirname, 'adapter.js');
const html = path.join(__dirname, 'index.html');

const proc = execFile('node', [
  './dist/cli.js', 'render',
  '--adapter', adapter,
  '--html', html,
  '--width', '1920', '--height', '1080', '--fps', '60',
  '--concurrency', '4',
  '--image-format', 'png',
  '--codec', 'h264', '--crf', '18', '--preset', 'medium',
  '--verbose', '-o', out
], { cwd: path.resolve(__dirname, '../../') });

proc.stdout.on('data', (d) => process.stdout.write(d)); // JSONL progress
proc.stderr.on('data', (d) => process.stderr.write(d));