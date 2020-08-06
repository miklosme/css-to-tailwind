const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { CSSStyleDeclaration } = require('cssstyle');
const allProperties = require('cssstyle/lib/allProperties');
const isMatchWith = require('lodash.ismatchwith');
const isEqual = require('lodash.isequal');
const parseSize = require('to-px');
const parseColor = require('css-color-converter');
const euclideanDistance = require('euclidean-distance');
const chalk = require('chalk');

const CONFIG = {
    COLOR_DELTA: 5,
    FULL_ROUND: 9999,
};

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

        // patch the npm package, bc it returns null for '0'
        const px = num === '0' ? 0 : parseSize(num);

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
        breakpoints: [10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 64],
    }),
});

const normalizeLineHeight = createTouplesConverter({
    props: ['line-height'],
    convertValue: createRounder({
        breakpoints: [12, 16, 20, 24, 28, 32, 36, 40],
    }),
});

const normalizeLetterSpacing = createTouplesConverter({
    props: ['letter-spacing'],
    convertValue: createRounder({
        breakpoints: [-0.8, -0.4, 0, 0.4, 0.8, 1.6],
    }),
});

const normalizeTouplesForBorderRadius = createTouplesConverter({
    props: ['border-radius'],
    convertValue: createRounder({
        breakpoints: [0, 2, 4, 6, 8],
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

const normalizeCommonSize = createTouplesConverter({
    props: [
        'width',
        'max-width',
        'min-width',

        'height',
        'max-height',
        'min-height',

        'padding',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',

        'margin',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
    ],
    convertValue: createRounder({
        breakpoints: [0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 224, 256],
    }),
});

const normalizeBorderWidth = createTouplesConverter({
    props: ['border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
    convertValue: createRounder({
        breakpoints: [0, 1, 2, 4, 8],
    }),
});

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

async function classesRawJson(css) {
    const classNames = await extractSingleClassNames(css);
    return slow_NormalizeClasses(css, classNames);
}

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
        const isUnsupportedSelector = /placeholder|focus|focus|hover|w-2\\\/|w-3\\\/|w-4\\\/|w-5\\\/|w-6\\\/|w-7\\\/|w-8\\\/|w-9\\\/|w-10\\\/|w-11\\\//.test(
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

function normalizeCssMap(touples) {
    // normalizeLineHeight
    // normalizeLetterSpacing
    // normalizeFontSize
    // normalizeTouplesForBorderRadius
    // normalizeTouplesByColor
    // normalizeBorderColorProperties
    // normalizeBorderStyleProperties
    // normalizeCommonSize
    // normalizeBorderWidth
    return normalizeLineHeight(
        normalizeLetterSpacing(
            normalizeFontSize(
                normalizeTouplesForBorderRadius(
                    normalizeTouplesByColor(
                        normalizeBorderColorProperties(
                            normalizeBorderStyleProperties(normalizeCommonSize(normalizeBorderWidth(touples))),
                        ),
                    ),
                ),
            ),
        ),
    );
}

function normalizeDictOfTouples(dict, fn) {
    return Object.fromEntries(
        Object.entries(dict).map(([twClass, touples]) => {
            return [twClass, fn(touples)];
        }),
    );
}

async function cssToTailwind(tailwindCss, inputCss) {
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

        const resultArray = Object.keys(filteredTailwind).sort();
        const resultSheet = Object.entries(tailwindSingleClassesJson).filter(([cn]) => resultArray.includes(cn));
        const tailwind = resultArray.join(' ');

        const resultMap = Object.keys(
            Object.entries(filteredTailwind).reduce((acc, [twClass, map]) => ({ ...acc, ...map }), {}),
        );

        const missing = Object.entries(inputNormalized[cssClass])
            .filter(([prop]) => !resultMap.includes(prop))
            .reduce(
                (str, [prop, value]) =>
                    `${str}\t${prop}: ${Object.fromEntries(inputNormalizedShorthands[cssClass])[prop]}\n`,
                '',
            );

        let error = null;
        let emoji = '✅';

        if (missing.length) {
            emoji = '⚠️ ';
        }

        if (resultArray.length === 0) {
            emoji = '❌';
            if (missing.length) {
                emoji = '⚠️ ';
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

(async () => {
    const tailwindCss = await fs.readFile('./tailwind.css', 'utf8');

    const inputCss = `
      .alert {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #FAD0D0;
        color: #fff;
        border-radius: 0.2rem;
        width: 100%;
      } 
      
      .guest-layout__logo {
        margin-bottom: 1.6rem;
        min-height: 4rem;
        display: flex;
        justify-content: center;
      }
      
      .guest-layout__container {
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 0.2rem;
      } 
      
      .guest-layout {
        margin: 8rem auto;
        max-width: fit-content;
      }
      
      .guest-layout__header {
        font-weight: 400;
        font-size: 2rem;
        line-height: 3rem;
        letter-spacing: 0.03rem;
        padding: 2.4rem;
        border-bottom: 1px solid #e5e5e5;
      }
      
      .guest-layout__footer {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-direction: row-reverse;
        padding: 2.4rem 3rem;
        border-top: 1px solid #e5e5e5;
      }
      
      .guest-layout__footer--compact {
        border: none;
        padding: 0;
        margin-top: 1.6rem;
      }
      
      .guest-layout__content {
        display: flex;
        flex-wrap: nowrap;
        width: 38rem;
      }
      
      .guest-layout__content--with-side-content {
        width: 76rem;
      }
      .guest-layout__content--with-side-contentdfdf {
        width: 50%;
      }
      
      .guest-layout__content--with-side-contentdfdf {
        width: 50%;
      }
      .guest-layout__content--with-separatordfdfdf{
        border-right: 1px solid #e5e5e5;
      }
      .guest-layout__content-inner {
        width: 100%;
        display: flex;
        justify-content: center;
        flex-direction: column;
        margin: 0;
        padding: 3rem;
      }
      
      .guest-layout__content--with-separatordfdf {
        background: unset;
      }
      .guest-layout__side-content {
        width: 50%;
        background: #e3e6e6;
        padding: 3rem;
        display: flex;
        justify-content: center;
        flex-direction: column;
      }
      .guest-layout__dfdfdfdf {
        margin-top: 0;
      }
      
      `;

    const input = await parseSingleClasses(inputCss);

    const results = await cssToTailwind(tailwindCss, inputCss);

    const resultsWithMissing = results.filter((result) => result.missing.length);

    results.forEach((result) => {
        const { cssClass, tailwind, missing, resultSheet, emoji, error } = result;

        console.log(emoji, chalk.bold(`.${cssClass}`), tailwind.length ? `--> "${chalk.italic(tailwind)}"` : '');
        if (error) {
            console.log('ℹ️ ', error, missing.length ? `Missing CSS:\n${chalk.green(missing)}` : '');
        }
        console.log();
    });

    console.log('Classes with missing:', resultsWithMissing.length);

    /*

    TODO

        - CONFIG font size to convert rem to px
        - result sort order should be the order as in tailwind.css
        - test user-select
        - lineHeight: simple number value
    */
})();
