import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'artifacts/raccoon-supply-shop/dist/public');
const html = await readFile(resolve(output, 'index.html'), 'utf8');
// Retain the existing root-only reference section; it is not community knowledge
// or a policy source and is deliberately absent from the crawler sitemap.
const oldRoot = await readFile(resolve(root, 'index.html'), 'utf8').catch(() => '');
const rootReference = oldRoot.match(/<section id="shipping-information">[\s\S]*?<\/section>/)?.[0];
if (!html.includes('/RaccoonTest/assets/') || !html.includes('id="root"')) {
  throw new Error('Build the storefront with BASE_PATH=/RaccoonTest/ before publishing.');
}
for (const destination of [root, resolve(root, 'docs')]) {
  await mkdir(destination, { recursive: true });
  // This directory contains only generated storefront bundles.
  await rm(resolve(destination, 'assets'), { recursive: true, force: true });
  await cp(output, destination, { recursive: true });
  if (destination === root && rootReference) {
    const published = await readFile(resolve(root, 'index.html'), 'utf8');
    await (await import('node:fs/promises')).writeFile(resolve(root, 'index.html'), published.replace('<div id="root"></div>', `<div id="root"></div>\n${rootReference}`));
  }
}
console.log('Published the storefront and help content to the repository root and docs/.');
