#!/usr/bin/env node

process.chdir(__dirname);

const { cssToTailwind } = require('.');

(async () => {
    console.log(JSON.stringify(await cssToTailwind(process.argv[2]), null, 2));
})();
