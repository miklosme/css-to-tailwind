const postCss = require('postcss');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const transform = require('./lib/transform');
const { setOptions } = require('./lib/options');

async function cssToTailwind(inputCss, _options) {
    const { TAILWIND_CONFIG, PREPROCESSOR_INPUT } = setOptions(_options)

    const { css: tailwindCss } = await postCss([
        postCssTailwind(TAILWIND_CONFIG || undefined),
        postCssAutoprefixer,
    ]).process(PREPROCESSOR_INPUT, { from: 'tailwind.css' });

    return transform(inputCss, tailwindCss);
}

module.exports = cssToTailwind;
