const parseUnit = require('parse-unit');
const postCssSelectorParser = require('postcss-selector-parser');
const postCssSafeParser = require('postcss-safe-parser');
const cssColorConverter = require('css-color-converter');

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

    let i = 0;
    postCssSelectorParser((selectors) => {
        selectors.walk((selector) => {
            if (selector.type === 'selector') {
                result[i++] = [];
            } else {
                result[i - 1].push(selector);
            }
        });
    }).processSync(selector);

    return result;
}

async function parseCss(css) {
    const ast = await postCssSafeParser(css);
    const result = {};

    ast.walkRules((rule) => {
        if (!result[rule.selector]) {
            result[rule.selector] = { atRuleName: null, atRuleParams: null, props: [] };

            if (rule.parent.type === 'atrule') {
                result[rule.selector].atRuleName = rule.parent.name;
                result[rule.selector].atRuleParams = rule.parent.params;
            }
        }
        rule.walkDecls((decl) => {
            result[rule.selector].props.push([decl.prop, decl.value]);
        });
    });

    return result;
}

function isSupportedTailwindRule(selector) {
    const isClass = selector.startsWith('.');

    if (!isClass) {
        return false;
    }

    const isUnsupportedSelector = /container|w-2\\\/|w-3\\\/|w-4\\\/|w-5\\\/|w-6\\\/|w-7\\\/|w-8\\\/|w-9\\\/|w-10\\\/|w-11\\\//.test(
        selector,
    );

    if (isUnsupportedSelector) {
        return false;
    }

    const selectorList = parseSelector(selector);
    
    if (selectorList.length !== 1) {
        return false;
    }

    // the selector must only contain a single element, with pseudo selectors
    if (selectorList[0].filter((el) => el.type !== 'pseudo').length !== 1) {
        return false;
    }

    return true;
}

async function parseTailwindCss(css) {
    const parsed = await parseCss(css);
    const filtered = Object.entries(parsed).filter(([twClass]) => isSupportedTailwindRule(twClass));
    return Object.fromEntries(filtered);
}

module.exports.parseColor = parseColor;
module.exports.parseSize = parseSize;
module.exports.parseCss = parseCss;
module.exports.parseSelector = parseSelector;
module.exports.parseTailwindCss = parseTailwindCss;
