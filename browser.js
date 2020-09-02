const merge = require('lodash.merge');
const transform = require('./lib/transform');

async function cssToTailwind(inputCss, _options) {
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

    if (!options.COMPILE_TAILWIND_CSS) {
        throw new Error("cssToTailwind's browser version needs the COMPILE_TAILWIND_CSS option to be set");
    }

    const tailwindCss = await options.COMPILE_TAILWIND_CSS({
        input: options.PREPROCESSOR_INPUT,
        tailwindConfig: options.TAILWIND_CONFIG,
    });

    const QUX = await transform(inputCss, tailwindCss, options);

    // debugger;

    return QUX;
}

module.exports = cssToTailwind;
