const chalk = require('chalk');
const path = require('path');
const cssToTailwind = require('./css-to-tailwind');

(async () => {
    const inputCss = `
      .alert {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #FAD0D0;
        color: #fff;
        border-radius: 0.2rem;
        width: 100%;
      } 
      
      .alert:hover {
        background: #2d3748;
      }
      
      `;

    const results = await cssToTailwind(inputCss);

    const resultsWithMissing = results.filter((result) => result.missing.length);

    results.forEach((result) => {
        const { selector, tailwind, missing } = result;
        const isFull = missing.length === 0;

        console.log(
            isFull ? '✅' : '⚠️ ',
            chalk.bold(selector),
            tailwind.length ? `--> "${chalk.italic(tailwind)}"` : '',
        );
        if (missing.length) {
            console.log(`Missing CSS:\n${chalk.green(JSON.stringify(Object.fromEntries(missing), null, 2))}`);
        }
        console.log();
    });

    console.log('Classes with missing:', resultsWithMissing.length);

    /*

    TODO

        - test user-select
        - lineHeight: simple number value
    */
})();
