const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { CSSStyleDeclaration } = require('cssstyle');
const allProperties = require('cssstyle/lib/allProperties');
const isMatchWith = require('lodash.ismatchwith');
const isEqual = require('lodash.isequal');
const flow = require('lodash.flow');
const parseUnit = require('parse-unit');
const parseColor = require('css-color-converter');
const euclideanDistance = require('euclidean-distance');
const postcss = require('postcss');

const resolveConfig = require('tailwindcss/resolveConfig');
const tailwindConfig = require(process.cwd() + '/tailwind.config.js');
const fullConfig = resolveConfig(tailwindConfig);

const CONFIG = {
    COLOR_DELTA: 5,
    FULL_ROUND: 9999,
    REM: 16,
    EM: 16,
};

function parseSize(val) {
    if (val === '0') {
        return 0;
    }

    const [value, unit] = parseUnit(val);

    if (unit === 'px') {
        return value;
    } else if (unit === 'rem') {
        return value * CONFIG.REM;
    } else if (unit === 'em') {
        return value * CONFIG.EM;
    }

    return val;
}

function getBreakPoints(data) {
    return Object.entries(data)
        .map(([size, val]) => parseSize(val))
        .filter((num) => typeof num === 'number')
        .sort((a, b) => a - b);
}

const colorProps = Array.from(allProperties).filter((prop) => prop.includes('color'));
const colorPropsSet = new Set(colorProps);

const createRounder = ({ breakpoints, bailFn } = {}) => {
    const rounder = (num) => {
        // do nothing if not in range
        if (num < breakpoints[0] || num > breakpoints[breakpoints.length - 1]) {
            return num;
        }
        const dist = breakpoints.map((size) => Math.abs(size - num));
        const index = dist.indexOf(Math.min(...dist));
        return breakpoints[index];
    };

    return (num) => {
        // this is a way to opt out of round when the input number is way too big for example
        if (bailFn) {
            const bailValue = bailFn(num);

            if (typeof bailValue !== 'undefined') {
                return `${rounder(px)}px`;
            }
        }

        const px = parseSize(num);

        if (typeof px === 'number') {
            return `${rounder(px)}px`;
        }

        return num;
    };
};

const createTouplesConverter = ({ props, convertProp = (x) => x, convertValue = (x) => x } = {}) => {
    const propSet = new Set(props);

    return (touples) =>
        touples.map(([prop, value]) => {
            if (propSet.has(prop)) {
                return [convertProp(prop), convertValue(value)];
            }

            return [prop, value];
        });
};

// //////
// //////
// //////
// //////

const normalizeFontSize = createTouplesConverter({
    props: ['font-size'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.fontSize),
    }),
});

const normalizeLineHeight = createTouplesConverter({
    props: ['line-height'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.lineHeight),
    }),
});

const normalizeLetterSpacing = createTouplesConverter({
    props: ['letter-spacing'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.letterSpacing),
    }),
});

const normalizeTouplesForBorderRadius = createTouplesConverter({
    props: ['border-radius'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.borderRadius).filter((num) => num < 100),
        bailFn: (num) => {
            // this must be a full round value
            if (num > 100) {
                return CONFIG.FULL_ROUND;
            }
        },
    }),
});

const normalizeTouplesByColor = createTouplesConverter({
    props: colorProps,
    convertValue: (value) => {
        const rgba = parseColor(value).toRgbaArray();
        if (Array.isArray(rgba) && rgba.length === 4) {
            return `rgba(${rgba.join(', ')})`;
        }

        return value;
    },
});

const normalizeBorderColorProperties = createTouplesConverter({
    props: ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
    convertProp: () => 'border-color',
});

const normalizeBorderStyleProperties = createTouplesConverter({
    props: ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
    convertProp: () => 'border-style',
});

const normalizeWidth = createTouplesConverter({
    props: ['width'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.width),
    }),
});
const normalizeHeight = createTouplesConverter({
    props: ['height'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.height),
    }),
});
const normalizeMargin = createTouplesConverter({
    props: ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.margin),
    }),
});
const normalizePadding = createTouplesConverter({
    props: ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.padding),
    }),
});
const normalizeGap = createTouplesConverter({
    props: ['gap'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.gap),
    }),
});

const normalizeBorderWidth = createTouplesConverter({
    props: ['border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
    convertValue: createRounder({
        breakpoints: getBreakPoints(fullConfig.theme.borderWidth),
    }),
});

const normalizeCssMap = flow([
    normalizeLineHeight,
    normalizeLetterSpacing,
    normalizeFontSize,
    normalizeTouplesForBorderRadius,
    normalizeTouplesByColor,
    normalizeBorderColorProperties,
    normalizeBorderStyleProperties,
    normalizeWidth,
    normalizeHeight,
    normalizeMargin,
    normalizePadding,
    normalizeGap,
    normalizeBorderWidth,
]);

// ///////
// ///////
// ///////
// ///////
// ///////
// ///////
// ///////
// ///////
// ///////
// ///////

function omitIf(obj, ...fns) {
    return Object.fromEntries(Object.entries(obj).filter((touple) => !fns.some((fn) => fn(touple))));
}

function isVariable([prop, value]) {
    return prop.startsWith('--');
}

function isSubset(parent, child, strict) {
    const a = omitIf(parent, isVariable);
    const b = omitIf(child, isVariable);
    if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
        return false;
    }
    return isMatchWith(a, b, (va, vb, key, aaa, bbb) => {
        if (strict) {
            return undefined;
        }

        if (colorPropsSet.has(key)) {
            const x = parseColor(va).toRgbaArray();
            const y = parseColor(vb).toRgbaArray();
            const distance = euclideanDistance(x, y);
            return distance < CONFIG.COLOR_DELTA;
        }

        return undefined;
    });
}

function touplesToCssDict(touples) {
    return touples.map(([prop, value]) => `${prop}: ${value}`).join(';');
}

async function parseSingleClasses(css) {
    const ast = await parse(css);
    const result = {};
    ast.walkRules((rule) => {
        const topLevel = rule.parent.type === 'root';
        const mediaMinWidth1280 = rule.parent.type === 'atrule' && rule.parent.params === '@media (min-width: 1280px)';
        const isSingleClass = !rule.selector.includes(' ') && rule.selector.startsWith('.');
        const isUnsupportedSelector = /container|placeholder|focus|focus|hover|w-2\\\/|w-3\\\/|w-4\\\/|w-5\\\/|w-6\\\/|w-7\\\/|w-8\\\/|w-9\\\/|w-10\\\/|w-11\\\//.test(
            rule.selector,
        );

        if ((topLevel || mediaMinWidth1280) && isSingleClass && !isUnsupportedSelector) {
            const selector = rule.selector.slice(1);
            rule.walkDecls((decl) => {
                if (!result[selector]) {
                    result[selector] = [];
                }
                result[selector].push([decl.prop, decl.value]);
            });
        }
    });

    return result;
}

async function extractSingleClasses(css) {
    const singleClassesJson = await parseSingleClasses(css);

    return Object.fromEntries(
        Object.entries(singleClassesJson).map(([cx, touples]) => [cx, Object.fromEntries(touples)]),
    );
}

function resolveLocalVariables(touples) {
    const variables = touples.filter((touple) => {
        return touple[0].startsWith('--');
    });

    return touples.map(([prop, value]) => {
        const resolvedValue = variables.reduce((str, [varN, varV]) => str.split(`var(${varN})`).join(varV), value);
        return [prop, resolvedValue];
    });
}

function normalizeShorthands(touples) {
    const declaration = new CSSStyleDeclaration();

    touples.forEach(([prop, value]) => {
        declaration.setProperty(prop, value);
    });

    return Object.entries(declaration.getNonShorthandValues());
}

function normalizeDictOfTouples(dict, fn) {
    return Object.fromEntries(
        Object.entries(dict).map(([twClass, touples]) => {
            return [twClass, fn(touples)];
        }),
    );
}

function filterTailwind(tailwindNormalized, inputNormalized, cssClass) {
    const cssMap = inputNormalized[cssClass];

    const filtered = Object.entries(tailwindNormalized)
        .filter(([twClass, value], index) => {
            return isSubset(cssMap, value);
        })
        // remove redundants
        .filter(([twClass, value], index, arr) => {
            for (let i = 0; i < arr.length; i++) {
                if (i === index) {
                    continue;
                }
                if (isSubset(arr[i][1], value, true)) {
                    return false;
                }
            }
            return true;
        });

    return Object.fromEntries(filtered);
}

async function cssToTailwind(inputCss) {
    const { css: tailwindCss } = await postcss([
        require('tailwindcss'),
        require('autoprefixer'),
    ]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: 'tailwind.css' });

    await fs.writeFile('./tailwind.css', tailwindCss, 'utf8');

    // const tailwindCss = await fs.readFile('./tailwind.css', 'utf8');

    const tailwindSingleClassesJson = await parseSingleClasses(tailwindCss);
    const inputSingleClassesJson = await parseSingleClasses(inputCss);

    const tailwindResolvedLocalVariables = normalizeDictOfTouples(tailwindSingleClassesJson, resolveLocalVariables);
    const inputResolvedLocalVariables = normalizeDictOfTouples(inputSingleClassesJson, resolveLocalVariables);

    const tailwindNormalizedShorthands = normalizeDictOfTouples(tailwindResolvedLocalVariables, normalizeShorthands);
    const inputNormalizedShorthands = normalizeDictOfTouples(inputResolvedLocalVariables, normalizeShorthands);

    const tailwindNormalizedCssValues = normalizeDictOfTouples(tailwindNormalizedShorthands, normalizeCssMap);
    const inputNormalizedCssValues = normalizeDictOfTouples(inputNormalizedShorthands, normalizeCssMap);

    const tailwindNormalized = normalizeDictOfTouples(tailwindNormalizedCssValues, Object.fromEntries);
    const inputNormalized = normalizeDictOfTouples(inputNormalizedCssValues, Object.fromEntries);

    await fs.writeFile('./tailwind.normalized.json', JSON.stringify(tailwindNormalized, null, 2), 'utf8');

    return Object.keys(inputSingleClassesJson).map((cssClass) => {
        const filteredTailwind = filterTailwind(tailwindNormalized, inputNormalized, cssClass);

        const tailwindClassesOrder = Object.fromEntries(
            Object.entries(Object.keys(tailwindNormalized)).map(([k, v]) => [v, k]),
        );

        const resultArray = Object.keys(filteredTailwind).sort(
            (a, b) => tailwindClassesOrder[a] - tailwindClassesOrder[b],
        );
        const resultSheet = Object.entries(tailwindSingleClassesJson).filter(([cn]) => resultArray.includes(cn));
        const tailwind = resultArray.join(' ');

        const resultMap = Object.keys(
            Object.entries(filteredTailwind).reduce((acc, [twClass, map]) => ({ ...acc, ...map }), {}),
        );

        const missing = Object.entries(inputNormalized[cssClass])
            .filter(([prop]) => !resultMap.includes(prop))
            .reduce(
                (str, [prop, value]) =>
                    `${str}\n\t${prop}: ${Object.fromEntries(inputNormalizedShorthands[cssClass])[prop]}`,
                '',
            );

        let error = null;
        let emoji = '✅';

        if (missing.length) {
            emoji = '⚠️ ';
        }

        if (resultArray.length === 0) {
            emoji = '⚠️ ';
            if (missing.length) {
                error = 'Could not match any Tailwind classes.';
            } else {
                error = 'This class only contained unsupported CSS.';
            }
        }

        return {
            cssClass,
            tailwind,
            resultArray,
            resultSheet: Object.fromEntries(resultSheet.map(([cn, touples]) => [cn, Object.fromEntries(touples)])),
            missing,
            emoji,
            error,
        };
    });
}

module.exports = cssToTailwind;
