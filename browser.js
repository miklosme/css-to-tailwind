const merge = require('lodash.merge');
const transform = require('./lib/transform');
const memoize = require('memoize-one/dist/memoize-one.cjs.js');

const getOptions = memoize((_options) => {
    return merge(
        {
            COLOR_DELTA: 2,
            FULL_ROUND: 9999,
            REM: 16,
            EM: 16,
            PREPROCESSOR_INPUT: '@tailwind base; @tailwind components; @tailwind utilities;',
            TAILWIND_CONFIG: null,
        },
        _options,
    );
});

async function cssToTailwind(inputCss, tailwindCss, _options) {
    const options = getOptions(_options);

    if (typeof tailwindCss !== 'string') {
        throw new Error('tailwindCss must be provided for the browser version');
    }

    const QUX = await transform(inputCss, tailwindCss, options);

    // debugger;

    return QUX;
}

module.exports = cssToTailwind;
