import crypto from 'crypto';
import { buildScryptHash } from '../modules/auth/auth.model.js';

function buildSha256Hash(rawPassword) {
  const digest = crypto.createHash('sha256').update(rawPassword).digest('hex');
  return `sha256:${digest}`;
}

function printUsage() {
  console.log('Uso: npm run auth:hash-password -- "<password>" [--sha256]');
}

function main() {
  const args = process.argv.slice(2);
  const useSha256 = args.includes('--sha256');
  const rawPassword = args.filter((arg) => arg !== '--sha256').join(' ');

  if (!rawPassword) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const hash = useSha256 ? buildSha256Hash(rawPassword) : buildScryptHash(rawPassword);
  console.log(hash);
}

main();
