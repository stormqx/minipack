const minipack = require('./src/minipack.js').minipack;

const res = minipack('./example/entry.js');
console.log(res);