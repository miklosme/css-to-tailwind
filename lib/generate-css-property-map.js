const postCss = require('postCss');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const postCssSafeParser = require('postcss-safe-parser');
const postCssSelectorParser = require('postcss-selector-parser');
const merge = require('lodash.merge');
const isEqual = require('lodash.isequal');

function isClass(selector) {
    try {
        let isFirst = true;
        postCssSelectorParser((selectors) => {
            selectors.walk((selector) => {
                if (selector.type === 'selector') {
                    return;
                }
                // bail if not class or has multiple parts
                if (selector.type !== 'class' || !isFirst) {
                    throw 'return';
                }
                isFirst = false;
            });
        }).processSync(selector);
    } catch (e) {
        if (e === 'return') {
            return false;
        }
        throw e;
    }

    return true;
}

async function generateCssPropertyMap(_options) {
    const options = merge(
        {
            PREPROCESSOR_INPUT: '@tailwind base;\n\n@tailwind components;\n\n@tailwind utilities;',
            TAILWIND_CONFIG: null,
        },
        _options,
    );
    const { css: tailwindCss } = await postCss([
        options.TAILWIND_CONFIG ? postCssTailwind(options.TAILWIND_CONFIG) : postCssTailwind,
        postCssAutoprefixer,
    ]).process(options.PREPROCESSOR_INPUT, { from: 'tailwind.css' });

    const ast = await postCssSafeParser(tailwindCss);

    const twClasses = {};

    ast.walkRules((rule) => {
        if (!isClass(rule.selector)) {
            return;
        }

        // remove the leading dot
        const selector = rule.selector.slice(1);

        twClasses[selector] = [];
        rule.walkDecls((decl) => {
            twClasses[selector].push(decl.prop);
        });
    });

    const result = {};
    const propSetMap = [];

    Object.entries(twClasses).forEach(([twClass, props]) => {
        let index = propSetMap.findIndex((otherProps) => isEqual(otherProps, props));

        if (index === -1) {
            index = propSetMap.length;
            propSetMap.push(props);
        }

        result[twClass] = index;
    });

    return result;
}

module.exports = generateCssPropertyMap;
