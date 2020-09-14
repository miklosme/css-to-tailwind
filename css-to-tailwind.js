const postCss = require('postcss');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const merge = require('lodash.merge');
const transform = require('./lib/transform');

async function cssToTailwind(inputCss, _options) {
    const options = merge(
        {
            COLOR_DELTA: 2,
            FULL_ROUND: 9999,
            REM: 16,
            EM: 16,
            PREPROCESSOR_INPUT: '@tailwind base;\n\n@tailwind components;\n\n@tailwind utilities;',
            TAILWIND_CONFIG: null,
        },
        _options,
    );

    const { css: tailwindCss } = await postCss([
        postCssTailwind(options.TAILWIND_CONFIG || undefined),
        postCssAutoprefixer,
    ]).process(options.PREPROCESSOR_INPUT, { from: 'tailwind.css' });

    return transform(inputCss, tailwindCss, options);
}

module.exports = cssToTailwind;
