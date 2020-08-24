const postcss = require('postcss');
const merge = require('lodash.merge');
const resolveConfig = require('tailwindcss/resolveConfig');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const cssToTailwind = require('./css-to-tailwind.js');

async function withCustomConfig(options) {
    const CONFIG = merge(
        {
            PREPROCESSOR_INPUT: '@tailwind base; @tailwind components; @tailwind utilities;',
        },
        options,
    );

    const tailwindResolvedJson = resolveConfig(require(CONFIG.TAILWIND_CONFIG));

    const { css: tailwindCss } = await postcss([
        postCssTailwind(CONFIG.TAILWIND_CONFIG),
        postCssAutoprefixer,
    ]).process(CONFIG.PREPROCESSOR_INPUT, { from: 'tailwind.css' });

    const cache = {
        tailwindResolvedJson,
        tailwindNormalizedJson: null,
        tailwindCss,
    };

    return (css, options) => cssToTailwind(css, merge(CONFIG, options), cache);
}

module.exports = withCustomConfig;
