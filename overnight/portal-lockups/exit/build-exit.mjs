// Builds a self-contained exit-disintegrate.html with board.png + home.png inlined
// as data URIs, so the prototype works standalone via file:// (no taint, no fetch).
import { readFileSync, writeFileSync } from 'node:fs';

const board = readFileSync(new URL('./assets/board.png', import.meta.url)).toString('base64');
const home  = readFileSync(new URL('./assets/home.png',  import.meta.url)).toString('base64');

const template = readFileSync(new URL('./exit-disintegrate.template.html', import.meta.url), 'utf8');

const out = template
  .replace('__BOARD_DATA_URI__', `data:image/png;base64,${board}`)
  .replace('__HOME_DATA_URI__',  `data:image/png;base64,${home}`);

writeFileSync(new URL('./exit-disintegrate.html', import.meta.url), out);
console.log('wrote exit-disintegrate.html', (out.length / 1024 / 1024).toFixed(2), 'MB');
