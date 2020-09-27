const resolveConfig = require('tailwindcss/resolveConfig');
const allProperties = require('cssstyle/lib/allProperties');
const { parseColor, parseSelector, parseSize } = require('./parsers');
const { CSSStyleDeclaration } = require('../patched-lib/CSSStyleDeclaration.js');
const { createRounder, getBreakPoints, createTouplesConverter, isVariable } = require('./utils');
const { buildAst: postCssParamsBuildAst } = require('postcss-params');
const flow = require('lodash.flow');

function parseAtruleParam(params) {
    // 'postcss-params' requires all expressions to be wrapped in parens
    // but single identifier expressions without parens are valid CSS

    // "print" -> "(print)"
    // "all and (min-width: 768px)" -> "(all) and (min-width: 768px)"

    const fixed = params.replace(/([a-z]+)(\sand|\sor|$)/g, '($1)$2');
    const result = postCssParamsBuildAst(fixed);
    const arr = Array.isArray(result) ? result : [result];
    return arr[0].all ? arr[0].all : arr;
}

const colorProps = Array.from(allProperties).filter((prop) => prop.includes('color'));

function normalizer(styleJson, options) {
    const resolvedConfig = resolveConfig(options.TAILWIND_CONFIG);

    const responsiveBreakpointNames = Object.fromEntries(
        Object.entries(resolvedConfig.theme.screens).map(([name, pixels]) => [parseSize(pixels), name]),
    );

    const breakpointRounder = createRounder({
        breakpoints: Object.keys(resolvedConfig.theme.screens).sort((a, z) => a - z),
        options,
    });

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

    const groupByVariants = Object.entries(styleJson).reduce((acc, [selector, { atRuleName, atRuleParams, props }]) => {
        const mediaRuleValue = atRuleName === 'media' ? atRuleParams : null;
        const { variantsKey, baseSelector } = getVariantFromSelector({
            selector,
            mediaRuleValue,
            responsiveBreakpointNames,
            breakpointRounder,
        });

        if (!acc[variantsKey]) {
            acc[variantsKey] = {};
        }

        acc[variantsKey][baseSelector] = props;

        return acc;
    }, {});

    return Object.fromEntries(
        Object.entries(groupByVariants).map(([variant, classesJson]) => {
            const resolvedLocalVariables = normalizeDictOfTouples(classesJson, resolveLocalVariables);
            const normalizedShorthands = normalizeDictOfTouples(resolvedLocalVariables, normalizeShorthands);
            const normalizedCssValues = normalizeDictOfTouples(normalizedShorthands, normalizeCssMap);
            return [variant, normalizeDictOfTouples(normalizedCssValues, Object.fromEntries)];
        }),
    );
}

function getVariantFromSelector({ selector, mediaRuleValue, responsiveBreakpointNames, breakpointRounder }) {
    const selectorList = parseSelector(selector);

    const variants = [];

    if (mediaRuleValue) {
        const minWidth = parseAtruleParam(mediaRuleValue).find((rule) => rule.feature === 'min-width');

        if (minWidth) {
            const minWidthValue = parseSize(breakpointRounder(minWidth.value));

            if (typeof minWidthValue === 'number') {
                if (!responsiveBreakpointNames[minWidthValue]) {
                    throw new Error(`unsupported min-width media query value: "${minWidthValue}"`);
                }
                variants.push(responsiveBreakpointNames[minWidthValue]);
            }
        }
    }

    const baseSelector = selectorList
        .map((selectorElements) => {
            return selectorElements
                .map((selectorElement, index, arr) => {
                    const { type, value } = selectorElement;

                    const isLastElementSelector = arr.slice(index, arr.length).every((el) => el.type !== 'combinator');

                    if (isLastElementSelector) {
                        if (type === 'pseudo') {
                            if (value.includes('hover')) {
                                variants.push('hover');
                                return null;
                            } else if (value.includes('focus')) {
                                variants.push('focus');
                                return null;
                            } else if (value.includes('placeholder')) {
                                variants.push('placeholder');
                                return null;
                            }
                        }
                    }

                    if (type === 'class') {
                        return `.${value}`;
                    } else if (type === 'id') {
                        return `#${value}`;
                    } else if (type === 'tag') {
                        return value;
                    } else if (type === 'combinator') {
                        if (value === ' ') {
                            return ' ';
                        }
                        return ` ${value} `;
                    } else if (type === 'pseudo') {
                        return value;
                    }

                    throw new Error(`unsupported css selector element type: ${type}`);
                })
                .join('');
        })
        .join(', ');

    const variantsKey = Array.from(variants).sort().join(',') || 'base';

    return {
        variants,
        variantsKey, // single, stable string to represent all variants
        baseSelector,
    };
}

module.exports = normalizer;
module.exports.getVariantFromSelector = getVariantFromSelector;
