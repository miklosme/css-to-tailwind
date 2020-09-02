const chalk = require('chalk');
const path = require('path');
const cssToTailwind = require('../css-to-tailwind');

(async () => {
    const inputCss = `
      .baz {
        padding: 1.6rem 4.6rem;
        background: url('logo.svg') no-repeat;
      }

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
        .bar {
          padding: 3rem 7rem;
          margin-bottom: 2.4rem;
        } 
      }

      .bar::placeholder {
        color: #e6e6e6;
      }
    `;

    const results = await cssToTailwind(inputCss, undefined, {
        TAILWIND_CONFIG: require(path.resolve(process.cwd(), 'fixtures/tailwind.config.js')),
        COLOR_DELTA: 5,
    });

    const resultsWithMissing = results.filter((result) => Object.keys(result.missing).length);

    results.forEach((result) => {
        const { selector, tailwind, missing } = result;
        const isFull = Object.keys(result.missing).length === 0;

        console.log(
            isFull ? '✅' : '⚠️ ',
            chalk.bold(selector),
            tailwind.length ? `--> "${chalk.italic(tailwind)}"` : '',
        );
        if (!isFull) {
            console.log(`Missing CSS:\n${chalk.green(JSON.stringify(missing, null, 2))}`);
        }
        console.log();
    });

    console.log('Classes with missing:', resultsWithMissing.length);
})();
