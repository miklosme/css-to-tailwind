const chalk = require('chalk');
const path = require('path');
const withCustomConfig = require('../with-custom-config');

(async () => {
    const inputCss = `
      .foo {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #FAD0D0;
        color: #fff;
        border-radius: 0.2rem;
        width: 100%;
      } 

      .bar {
        position: relative;
        padding: 1.6rem 4.6rem;
      }
      
      .foo:hover {
        background: #cccccc;
      }

      .foo:focus {
        border-color: #e2f2f0;
      }

      @media (min-width: 1280px) {
        .foo {
          padding: 3rem 7rem;
          margin-bottom: 2.4rem;
        } 
      }

      /*
      .foo::placeholder {
        color: #e6e6e6;
      }
      */
    `;

    const cssToTailwind = await withCustomConfig({
        TAILWIND_CONFIG: path.resolve(process.cwd(), 'customs/tailwind.config.js'),
    })

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
})();
