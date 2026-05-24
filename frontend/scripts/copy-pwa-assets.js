const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const sourceFavicon = path.join(projectRoot, 'assets', 'favicon.ico');
const distFavicon = path.join(distDir, 'favicon.ico');
const distIndexHtml = path.join(distDir, 'index.html');

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);
}

function patchFaviconLink(html, version) {
  const iconHrefWithVersion = `/favicon.ico?v=${version}`;

  if (html.includes('rel="icon"')) {
    return html.replace(/<link rel="icon" href="[^\"]*"\s*\/>/, `<link rel="icon" href="${iconHrefWithVersion}" />`);
  }

  if (html.includes('</head>')) {
    return html.replace('</head>', `  <link rel="icon" href="${iconHrefWithVersion}" />\n</head>`);
  }

  return html;
}

function main() {
  ensureFile(sourceFavicon);
  ensureFile(distDir);
  ensureFile(distIndexHtml);

  fs.copyFileSync(sourceFavicon, distFavicon);

  const version = fileHash(distFavicon);
  const originalHtml = fs.readFileSync(distIndexHtml, 'utf8');
  const patchedHtml = patchFaviconLink(originalHtml, version);

  if (patchedHtml !== originalHtml) {
    fs.writeFileSync(distIndexHtml, patchedHtml, 'utf8');
  }

  console.log(`Copied favicon to dist: ${distFavicon}`);
  console.log(`Applied favicon cache-bust version: ${version}`);
}

try {
  main();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
