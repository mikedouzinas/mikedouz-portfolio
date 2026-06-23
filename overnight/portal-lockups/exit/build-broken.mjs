import { readFileSync, writeFileSync } from 'node:fs';
const board = readFileSync(new URL('./assets/board.png', import.meta.url)).toString('base64');
const home  = readFileSync(new URL('./assets/home.png',  import.meta.url)).toString('base64');
const tpl = readFileSync(new URL('./exit-broken.template.html', import.meta.url), 'utf8');
writeFileSync(new URL('./exit-broken.html', import.meta.url),
  tpl.replace('__BOARD_DATA_URI__', `data:image/png;base64,${board}`)
     .replace('__HOME_DATA_URI__',  `data:image/png;base64,${home}`));
console.log('wrote exit-broken.html');
