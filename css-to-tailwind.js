const { CSSStyleDeclaration } = require('./patched-lib/CSSStyleDeclaration.js');
const { createRounder, getBreakPoints, createTouplesConverter } = require('./lib/utils');
const { parseColor, parseCss } = require('./lib/parsers');
const resolveConfig = require('tailwindcss/resolveConfig');
const postCss = require('postCss');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const allProperties = require('cssstyle/lib/allProperties');
const isMatchWith = require('lodash.ismatchwith');
const flow = require('lodash.flow');
const merge = require('lodash.merge');
const euclideanDistance = require('euclidean-distance');

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

    const resolvedConfig = resolveConfig(options.TAILWIND_CONFIG);

    const { css: tailwindCss } = await postCss([
        postCssTailwind(options.TAILWIND_CONFIG || undefined),
        postCssAutoprefixer,
    ]).process(options.PREPROCESSOR_INPUT, { from: 'tailwind.css' });

    // //////
    // //////
    // //////
    // //////

    const normalizeFontSize = createTouplesConverter({
        props: ['font-size'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.fontSize, options),
            options,
        }),
    });

    const normalizeLineHeight = createTouplesConverter({
        props: ['line-height'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.lineHeight, options),
            options,
        }),
    });

    const normalizeLetterSpacing = createTouplesConverter({
        props: ['letter-spacing'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.letterSpacing, options),
            options,
        }),
    });

    const normalizeBorderRadius = createTouplesConverter({
        props: ['border-radius'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.borderRadius, options).filter((num) => num < 100),
            bailFn: (num) => {
                // this must be a full round value
                if (num > 100) {
                    return options.FULL_ROUND;
                }
            },
            options,
        }),
    });

    const colorProps = Array.from(allProperties).filter((prop) => prop.includes('color'));
    const colorPropsSet = new Set(colorProps);

    const normalizeColorValues = createTouplesConverter({
        props: colorProps,
        convertValue: (value) => {
            const rgba = parseColor(value);
            if (rgba !== null) {
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
            breakpoints: getBreakPoints(resolvedConfig.theme.width, options),
            options,
        }),
    });
    const normalizeHeight = createTouplesConverter({
        props: ['height'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.height, options),
            options,
        }),
    });
    const normalizeMargin = createTouplesConverter({
        props: ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.margin, options),
            options,
        }),
    });
    const normalizePadding = createTouplesConverter({
        props: ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.padding, options),
            options,
        }),
    });
    const normalizeGap = createTouplesConverter({
        props: ['gap'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.gap, options),
            options,
        }),
    });

    const normalizeBorderWidth = createTouplesConverter({
        props: ['border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.borderWidth, options),
            options,
        }),
    });

    const normalizeCssMap = flow([
        normalizeLineHeight,
        normalizeLetterSpacing,
        normalizeFontSize,

        normalizeColorValues,

        normalizeBorderRadius,
        normalizeBorderWidth,
        normalizeBorderColorProperties,
        normalizeBorderStyleProperties,

        normalizeWidth,
        normalizeHeight,
        normalizeMargin,
        normalizePadding,
        normalizeGap,
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

    function isVariable([prop]) {
        return prop.startsWith('--');
    }

    function normalizeDictOfTouples(dict, fn) {
        return Object.fromEntries(
            Object.entries(dict).map(([twClass, touples]) => {
                return [twClass, fn(touples)];
            }),
        );
    }

    function resolveLocalVariables(touples) {
        const variables = touples.filter(isVariable);

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

    async function createNormalizedClasses(css) {
        const variants = await parseCss(css);

        return Object.fromEntries(
            Object.entries(variants).map(([variant, classesJson]) => {
                const resolvedLocalVariables = normalizeDictOfTouples(classesJson, resolveLocalVariables);
                const normalizedShorthands = normalizeDictOfTouples(resolvedLocalVariables, normalizeShorthands);
                const normalizedCssValues = normalizeDictOfTouples(normalizedShorthands, normalizeCssMap);
                return [variant, normalizeDictOfTouples(normalizedCssValues, Object.fromEntries)];
            }),
        );
    }

    // ////////
    // ////////
    // ////////
    // ////////
    // ////////
    // ////////

    function isSubset(parent, child, strict) {
        const a = omitIf(parent, isVariable);
        const b = omitIf(child, isVariable);
        if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
            return false;
        }
        return isMatchWith(a, b, (va, vb, key) => {
            if (strict) {
                return undefined;
            }

            if (colorPropsSet.has(key)) {
                const x = parseColor(va);
                const y = parseColor(vb);
                if (x === null || y === null) {
                    return va === vb;
                }
                const distance = euclideanDistance(x, y);
                return distance < options.COLOR_DELTA;
            }

            return undefined;
        });
    }

    function filterTailwind(tailwindNormalized, inputNormalized, selector) {
        const cssMap = inputNormalized[selector];
        const filtered = Object.entries(tailwindNormalized)
            .filter(([twClass, value]) => {
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

    function FOO(variant, tailwindNormalized, inputNormalized) {
        return Object.keys(inputNormalized).map((selector) => {
            const resultTailwind = filterTailwind(tailwindNormalized, inputNormalized, selector);

            const tailwindClassesOrder = Object.fromEntries(
                Object.keys(tailwindNormalized).map((twClass, index) => [twClass, index]),
            );

            const resultArray = Object.keys(resultTailwind).sort(
                (a, b) => tailwindClassesOrder[a] - tailwindClassesOrder[b],
            );

            const tailwind = resultArray
                // remove the leading dot
                .map((selector) => selector.slice(1))
                .join(' ');

            const resultMap = Object.keys(Object.values(resultTailwind).reduce((acc, map) => ({ ...acc, ...map }), {}));

            const missing = Object.entries(inputNormalized[selector])
                .filter(([prop]) => !resultMap.includes(prop))
                .map(([prop, value]) => [prop, inputNormalized[selector][prop]]);

            return {
                selector,
                tailwind,
                missing: missing.length
                    ? {
                          [variant]: missing,
                      }
                    : {},
            };
        });
    }

    const tailwindNormalized = await createNormalizedClasses(tailwindCss);
    const inputNormalized = await createNormalizedClasses(inputCss);

    const BAZ = Object.entries(inputNormalized)
        .flatMap(([variant, inputNormalized]) => {
            const BAR = tailwindNormalized[variant];

            return FOO(variant, BAR, inputNormalized);
        })
        .reduce((acc, curr) => {
            if (!acc[curr.selector]) {
                acc[curr.selector] = [];
            }
            acc[curr.selector].push(curr);
            return acc;
        }, {});

    const QUX = Object.entries(BAZ).map(([baseSelector, results]) => {
        return results.reduce((acc, curr) => {
            return {
                selector: curr.selector,
                tailwind: acc.tailwind ? acc.tailwind.concat(' ', curr.tailwind) : curr.tailwind,
                missing: acc.missing ? { ...acc.missing, ...curr.missing } : curr.missing,
            };
        });
    });

    debugger;

    return QUX;
}

module.exports = cssToTailwind;
