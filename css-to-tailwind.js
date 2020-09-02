const postCss = require('postCss');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const merge = require('lodash.merge');
const transform = require('./lib/transform')

async function cssToTailwind(inputCss, tailwindCss, _options) {
    const options = merge(
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

    if (!tailwindCss) {
        const { css } = await postCss([
            postCssTailwind(options.TAILWIND_CONFIG || undefined),
            postCssAutoprefixer,
        ]).process(options.PREPROCESSOR_INPUT, { from: 'tailwind.css' });

        tailwindCss = css;
    }

    const QUX = await transform(inputCss, tailwindCss, options);

    debugger;

    return QUX;
}

module.exports = cssToTailwind;
