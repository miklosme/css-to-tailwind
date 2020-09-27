const transform = require('./lib/transform');
const { setOptions } = require('./lib/options');

async function cssToTailwind(inputCss, tailwindCss, options) {
    setOptions(options)

    if (typeof tailwindCss !== 'string') {
        throw new Error('You are using the browser package, but did not provide the `tailwind.css` content. Browser use-cases are reponsible to build `tailwind.css` themselves.');
    }

    return transform(inputCss, tailwindCss);
}

module.exports = cssToTailwind;
