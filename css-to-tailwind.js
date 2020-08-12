const parseCss = require('postcss-safe-parser');
const parseSelector = require('postcss-selector-parser');
const { CSSStyleDeclaration } = require('cssstyle');
const allProperties = require('cssstyle/lib/allProperties');
const isMatchWith = require('lodash.ismatchwith');
const flow = require('lodash.flow');
const merge = require('lodash.merge');
const parseUnit = require('parse-unit');
const cssColorConverter = require('css-color-converter');
const euclideanDistance = require('euclidean-distance');
const defaultTailwindResolvedJson = require('./defaults/tailwind.resolved.json');
const defaultTailwindNormalizedJson = require('./defaults/tailwind.normalized.json');

async function cssToTailwind(inputCss, options, cache) {
    const CONFIG = merge(
        {
            COLOR_DELTA: 5,
            FULL_ROUND: 9999,
            REM: 16,
            EM: 16,
        },
        options,
    );
    const CACHE = merge(
        {
            tailwindResolvedJson: defaultTailwindResolvedJson,
            tailwindNormalizedJson: defaultTailwindNormalizedJson,
        },
        cache,
    );

    const resolvedConfig = CACHE.tailwindResolvedJson;

    function parseColor(color) {
        const rgba = cssColorConverter(color).toRgbaArray();
        if (Array.isArray(rgba) && rgba.length === 4) {
            return rgba;
        }
        return null;
    }

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

    const createRounder = ({ breakpoints, bailFn }) => {
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

    const createTouplesConverter = ({ props, convertProp = (x) => x, convertValue = (x) => x }) => {
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
            breakpoints: getBreakPoints(resolvedConfig.theme.fontSize),
        }),
    });

    const normalizeLineHeight = createTouplesConverter({
        props: ['line-height'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.lineHeight),
        }),
    });

    const normalizeLetterSpacing = createTouplesConverter({
        props: ['letter-spacing'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.letterSpacing),
        }),
    });

    const normalizeBorderRadius = createTouplesConverter({
        props: ['border-radius'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.borderRadius).filter((num) => num < 100),
            bailFn: (num) => {
                // this must be a full round value
                if (num > 100) {
                    return CONFIG.FULL_ROUND;
                }
            },
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
            breakpoints: getBreakPoints(resolvedConfig.theme.width),
        }),
    });
    const normalizeHeight = createTouplesConverter({
        props: ['height'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.height),
        }),
    });
    const normalizeMargin = createTouplesConverter({
        props: ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.margin),
        }),
    });
    const normalizePadding = createTouplesConverter({
        props: ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.padding),
        }),
    });
    const normalizeGap = createTouplesConverter({
        props: ['gap'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.gap),
        }),
    });

    const normalizeBorderWidth = createTouplesConverter({
        props: ['border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
        convertValue: createRounder({
            breakpoints: getBreakPoints(resolvedConfig.theme.borderWidth),
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

    function parseSelectorAsVariants(selector) {
        const all = [];
        parseSelector((selectors) => {
            console.log('outer', selector)
            selectors.walk((selector) => {
                console.log('inner', selector)
                all.push({ type: selector.type, value: selector.value });
            });
        }).processSync(selector);

        const result = { selector, singelSelector: null, pseudos: [] };
        for (let i = all.length - 1; i >= 0; i--) {
            console.log(i, all[i].type)
            if (['class', 'id', 'tag'].includes(all[i].type)) {
                result.singelSelector = all[i].value;
                break;
            } else if (all[i].type === 'pseudo') {
                result.pseudos.push(all[i].value);
            } else {
                break;
            }
        }
        return result;
    }

    console.log(parseSelectorAsVariants('div p > .foo .bar:hover  #id .baz:focus::placeholder'))

    debugger

    async function parseRules(css, filterFn) {
        const ast = await parseCss(css);
        const result = {};
        ast.walkRules((rule) => {
            if (!filterFn || filterFn(rule)) {
                rule.walkDecls((decl) => {
                    if (!result[rule.selector]) {
                        result[rule.selector] = [];
                    }
                    result[rule.selector].push([decl.prop, decl.value]);
                });
            }
        });

        return result;
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

    async function createNormalizedClasses(css, filterFn) {
        const singleClassesJson = await parseRules(css, filterFn);
        const resolvedLocalVariables = normalizeDictOfTouples(singleClassesJson, resolveLocalVariables);
        const normalizedShorthands = normalizeDictOfTouples(resolvedLocalVariables, normalizeShorthands);
        const normalizedCssValues = normalizeDictOfTouples(normalizedShorthands, normalizeCssMap);
        return normalizeDictOfTouples(normalizedCssValues, Object.fromEntries);
    }

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
                return distance < CONFIG.COLOR_DELTA;
            }

            return undefined;
        });
    }

    function isSupportedTailwindRule(rule) {
        const topLevel = rule.parent.type === 'root';
        const mediaMinWidth1280 = rule.parent.type === 'atrule' && rule.parent.params === '@media (min-width: 1280px)';
        const isSingleClass = !rule.selector.includes(' ') && rule.selector.startsWith('.');
        const isUnsupportedSelector = /container|placeholder|focus|hover|w-2\\\/|w-3\\\/|w-4\\\/|w-5\\\/|w-6\\\/|w-7\\\/|w-8\\\/|w-9\\\/|w-10\\\/|w-11\\\//.test(
            rule.selector,
        );

        return (topLevel || mediaMinWidth1280) && isSingleClass && !isUnsupportedSelector;
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

    // function groupByClassName(acc, { selector, tailwindJson }) {}

    const inputNormalized = await createNormalizedClasses(inputCss);

    let tailwindNormalized = CACHE.tailwindNormalizedJson;

    if (!tailwindNormalized) {
        tailwindNormalized = await createNormalizedClasses(CACHE.tailwindCss, isSupportedTailwindRule);
        CACHE.tailwindNormalizedJson = tailwindNormalized;
    }

    // const x = Object.keys(inputNormalized)
    //     .map((selector) => {
    //         const tailwindJson = filterTailwind(tailwindNormalized, inputNormalized, selector);
    //         return { selector, tailwindJson };
    //     })
    //     .reduce(groupByClassName, {});

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

        const resultMap = Object.keys(
            Object.entries(resultTailwind).reduce((acc, [twClass, map]) => ({ ...acc, ...map }), {}),
        );

        const missing = Object.entries(inputNormalized[selector])
            .filter(([prop]) => !resultMap.includes(prop))
            .map(([prop, value]) => [prop, inputNormalized[selector][prop]]);

        return {
            selector,
            tailwind,
            missing,
        };
    });
}

module.exports = cssToTailwind;
