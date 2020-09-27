const postCss = require('postcss');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const merge = require('lodash.merge');
const transform = require('./lib/transform');
const defaultOptions = require('./lib/default-options');

async function cssToTailwind(inputCss, _options) {
    const options = merge(defaultOptions, _options);

    const { css: tailwindCss } = await postCss([
        postCssTailwind(options.TAILWIND_CONFIG || undefined),
        postCssAutoprefixer,
    ]).process(options.PREPROCESSOR_INPUT, { from: 'tailwind.css' });

    return transform(inputCss, tailwindCss, options);
}

module.exports = cssToTailwind;
