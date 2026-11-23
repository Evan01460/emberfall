// Bundles the game into ONE self-contained HTML file: dist/emberfall.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const js = await build({ entryPoints: ['src/client/main.js'], bundle: true, minify: !process.env.DEBUG_BUILD, format: 'iife', write: false, target: 'es2020', define: { __GLOBAL_WS__: JSON.stringify(process.env.EMBERFALL_GLOBAL_WS ?? '') } });
const font = readFileSync('assets/pixel.woff2').toString('base64');
const css = readFileSync('style.css', 'utf8').replace('url(assets/pixel.woff2)', `url(data:font/woff2;base64,${font})`);
const html = readFileSync('index.html', 'utf8')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="src/client/main.js"></script>', () => `<script>${js.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>')}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/emberfall.html', html);
console.log(`dist/emberfall.html  ${(html.length / 1024).toFixed(0)} KB`);

// Artifact-format variant: no doctype/html/head/body wrapper (the host supplies the skeleton).
const art = `<title>Emberfall</title>\n<style>${css}</style>\n<div id="app"></div>\n<script>${js.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>')}</script>\n`;
writeFileSync('dist/artifact.html', art);
console.log(`dist/artifact.html       ${(art.length / 1024).toFixed(0)} KB`);
