const postcss = require('postcss');
const resolveConfig = require('tailwindcss/resolveConfig');
const merge = require('lodash.merge');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const { cssToTailwind } = require('./css-to-tailwind.js');

async function withCustomConfig(options) {
    const CONFIG = merge(
        {
            PREPROCESSOR_INPUT: '@tailwind base; @tailwind components; @tailwind utilities;',
        },
        options,
    );

    if (typeof CONFIG.TAILWIND_CONFIG === 'string') {
        CONFIG.TAILWIND_CONFIG = require(CONFIG.TAILWIND_CONFIG);
    }

    const tailwindResolvedJson = resolveConfig(CONFIG.TAILWIND_CONFIG);

    const { css: tailwindCss } = await postcss([
        postCssTailwind,
        postCssAutoprefixer,
    ]).process(CONFIG.PREPROCESSOR_INPUT, { from: 'tailwind.css' });

    const cache = {
        tailwindResolvedJson,
        tailwindCss,
    };

    return (css) => cssToTailwind(css, CONFIG, cache);
}

module.exports = withCustomConfig;
