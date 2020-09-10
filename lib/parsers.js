const parseUnit = require('parse-unit');
const postCssSelectorParser = require('postcss-selector-parser');
const postCssSafeParser = require('postcss-safe-parser');
const cssColorConverter = require('css-color-converter');
const { buildAst: postCssParamsBuildAst } = require('postcss-params');

function parseAtruleParam(params) {
    // 'postcss-params' requires all nodes to be wrapped in parens
    // but single identifier expressions are valid CSS

    // "print" -> "(print)"
    // "all and (min-width: 768px)" -> "(all) and (min-width: 768px)"
    
    const fixed = params.replace(/([a-z]+)(\sand|\sor|$)/, '($1)$2');
    const result = postCssParamsBuildAst(fixed);
    return Array.isArray(result) ? result : [result];
}

function parseColor(color) {
    const rgba = cssColorConverter(color).toRgbaArray();
    if (Array.isArray(rgba) && rgba.length === 4) {
        return rgba;
    }
    return null;
}

function parseSize(val, options) {
    if (val === '0') {
        return 0;
    }

    const [value, unit] = parseUnit(val);

    if (unit === 'px') {
        return value;
    } else if (unit === 'rem') {
        return value * options.REM;
    } else if (unit === 'em') {
        return value * options.EM;
    }

    return val;
}

function parseSelector(selector) {
    const result = [];

    postCssSelectorParser((selectors) => {
        selectors.walk((selector) => {
            if (selector.type !== 'selector') {
                result.push(selector);
            }
        });
    }).processSync(selector);

    return result;
}

const responsiveBreakpoints = {
    640: 'sm',
    768: 'md',
    1024: 'lg',
    1280: 'xl',
};

function getVariantFromSelector(selector, mediaRuleValue, options) {
    const all = parseSelector(selector);

    let variants = [];

    if (mediaRuleValue) {
        const mediaRuleAst = parseAtruleParam(mediaRuleValue);
        const minWidth = mediaRuleAst.find((rule) => rule.feature === 'min-width');
        if (minWidth) {
            const minWidthValue = parseSize(minWidth.value, options);

            if (typeof minWidthValue === 'number') {
                // TODO get this from config
                if (!responsiveBreakpoints[minWidthValue]) {
                    throw new Error(`unsupported mid-width media query value: "${minWidthValue}"`);
                }
                variants.push(responsiveBreakpoints[minWidthValue]);
            }
        }
    }

    const baseSelector = [];
    let isProcessingPseudosOfFirstElement = true;

    for (let i = all.length - 1; i >= 0; i--) {
        let value = all[i].value;

        if (isProcessingPseudosOfFirstElement) {
            if (all[i].type === 'pseudo') {
                if (value.includes('hover')) {
                    variants.push('hover');
                    continue;
                } else if (value.includes('focus')) {
                    variants.push('focus');
                    continue;
                } else if (value.includes('placeholder')) {
                    variants.push('placeholder');
                    continue;
                }
            } else {
                isProcessingPseudosOfFirstElement = false;
            }
        }

        if (all[i].type === 'class') {
            value = `.${value}`;
        } else if (all[i].type === 'id') {
            value = `#${value}`;
        }

        baseSelector.push(value);
    }
    return {
        variants: variants.length ? variants : ['default'],
        baseSelector: baseSelector.reverse().join(''),
    };
}

function isSupportedTailwindRule(rule) {
    const isClass = rule.selector.startsWith('.');

    if (!isClass) {
        return false;
    }

    const isUnsupportedSelector = /container|w-2\\\/|w-3\\\/|w-4\\\/|w-5\\\/|w-6\\\/|w-7\\\/|w-8\\\/|w-9\\\/|w-10\\\/|w-11\\\//.test(
        rule.selector,
    );

    if (isUnsupportedSelector) {
        return false;
    }

    if (parseSelector(rule.selector).filter((fragment) => fragment.type !== 'pseudo').length > 1) {
        return false;
    }

    return true;
}

// TODO parseCss should be agnostic of options/isTailwindCss/variants
// those stuff needs to happen in the normalizer
async function parseCss(css, options, isTailwindCss) {
    const ast = await postCssSafeParser(css);
    const result = {};
    ast.walkRules((rule) => {
        if (isTailwindCss && !isSupportedTailwindRule(rule)) {
            return;
        }
        const mediaRuleValue = rule.parent.name === 'media' ? rule.parent.params : null;
        const { variants, baseSelector } = getVariantFromSelector(rule.selector, mediaRuleValue, options);
        const ruleTuples = [];
        rule.walkDecls((decl) => {
            ruleTuples.push([decl.prop, decl.value]);
        });

        const variantsKey = Array.from(variants).sort().join(',');

        if (!result[variantsKey]) {
            result[variantsKey] = {};
        }

        result[variantsKey][baseSelector] = ruleTuples;
    });

    return result;
}

module.exports.getVariantFromSelector = getVariantFromSelector;
module.exports.parseColor = parseColor;
module.exports.parseSize = parseSize;
module.exports.parseCss = parseCss;
