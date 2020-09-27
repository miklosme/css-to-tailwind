const merge = require('lodash.merge');
const transform = require('./lib/transform');
const defaultOptions = require('./lib/default-options');
const memoize = require('memoize-one/dist/memoize-one.cjs.js');

// memoizing this helps memoization inside the `transform` function
const getOptions = memoize((_options) => {
    return merge(defaultOptions, _options);
});

async function cssToTailwind(inputCss, tailwindCss, _options) {
    const options = getOptions(_options);

    if (typeof tailwindCss !== 'string') {
        throw new Error('tailwindCss must be provided for the browser version');
    }

    return transform(inputCss, tailwindCss, options);
}

module.exports = cssToTailwind;
