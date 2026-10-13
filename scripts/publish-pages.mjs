import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'artifacts/raccoon-supply-shop/dist/public');
const html = await readFile(resolve(output, 'index.html'), 'utf8');
if (!html.includes('/RaccoonTest/assets/') || !html.includes('id="root"')) {
  throw new Error('Build the storefront with BASE_PATH=/RaccoonTest/ before publishing.');
}
for (const destination of [root, resolve(root, 'docs')]) {
  await mkdir(destination, { recursive: true });
  // This directory contains only generated storefront bundles.
  await rm(resolve(destination, 'assets'), { recursive: true, force: true });
  await cp(output, destination, { recursive: true });
}
console.log('Published the storefront and help content to the repository root and docs/.');
