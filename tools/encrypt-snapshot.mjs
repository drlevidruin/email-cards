// Encrypts a mail dataset into the snapshot file the app opens with a key link.
// Usage: node tools/encrypt-snapshot.mjs <dataset.json> <key-file> <out.bin>
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const [, , datasetPath, keyPath, outPath] = process.argv;
if (!datasetPath || !keyPath || !outPath) {
  console.error('Usage: node tools/encrypt-snapshot.mjs <dataset.json> <key-file> <out.bin>');
  process.exit(1);
}

// Real paths, compared without case, so a symlink or an alias of the repo folder is still caught
const real = (p) => {
  const abs = resolve(p);
  const dir = existsSync(dirname(abs)) ? realpathSync(dirname(abs)) : dirname(abs);
  return join(dir, basename(abs));
};
const repoRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const insideRepo = (p) => (real(p).toLowerCase() + sep).startsWith(repoRoot.toLowerCase() + sep);
const keyAbs = real(keyPath);
if (insideRepo(keyPath)) {
  console.error('Refused: the key file must live outside the repo folder.');
  process.exit(1);
}
if (insideRepo(datasetPath)) {
  console.error('Refused: the readable dataset must live outside the repo folder.');
  process.exit(1);
}

const text = readFileSync(datasetPath, 'utf8');
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error('Refused: the dataset is not valid JSON.');
  process.exit(1);
}
if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.threads)) {
  console.error('Refused: the dataset needs accounts and threads arrays.');
  process.exit(1);
}

const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
let keyBytes;
if (existsSync(keyAbs)) {
  keyBytes = new Uint8Array(Buffer.from(readFileSync(keyAbs, 'utf8').trim(), 'base64url'));
  if (keyBytes.length !== 32) {
    console.error('Refused: the key file does not hold 32 bytes of base64url.');
    process.exit(1);
  }
} else {
  keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
  writeFileSync(keyAbs, b64u(keyBytes) + '\n', { mode: 0o600 });
}

// A fresh id on every run, so a browser drops the state it saved from an older snapshot
data.snapshotId = Buffer.from(webcrypto.getRandomValues(new Uint8Array(6))).toString('hex');
const key = await webcrypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const cipher = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data))));
const out = new Uint8Array(3 + 12 + cipher.length);
out.set(new TextEncoder().encode('EC1'), 0);
out.set(iv, 3);
out.set(cipher, 15);
writeFileSync(outPath, out);
console.log(`Wrote ${out.length} bytes to ${resolve(outPath)}`);
console.log(`Key file: ${keyAbs}`);
