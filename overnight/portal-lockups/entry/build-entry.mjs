// Builds a self-contained entry-assemble.html with board.png + home.png inlined
// as data URIs, so the prototype works standalone via file:// (no taint, no fetch).
import { readFileSync, writeFileSync } from 'node:fs';

// assets live in the sibling exit prototype's assets dir
const board = readFileSync(new URL('../exit/assets/board.png', import.meta.url)).toString('base64');
const home  = readFileSync(new URL('../exit/assets/home.png',  import.meta.url)).toString('base64');

const template = readFileSync(new URL('./entry-assemble.template.html', import.meta.url), 'utf8');

const out = template
  .replace('__BOARD_DATA_URI__', `data:image/png;base64,${board}`)
  .replace('__HOME_DATA_URI__',  `data:image/png;base64,${home}`);

writeFileSync(new URL('./entry-assemble.html', import.meta.url), out);
console.log('wrote entry-assemble.html', (out.length / 1024 / 1024).toFixed(2), 'MB');
