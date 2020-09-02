const { parseColor, parseCss: _parseCss } = require('./parsers');
const _normalizer = require('./normalizer');
const { isVariable, omitIf } = require('./utils');
const allProperties = require('cssstyle/lib/allProperties');
const isMatchWith = require('lodash.ismatchwith');
const isEqual = require('lodash.isequal');
const euclideanDistance = require('euclidean-distance');
const memoizeOne = require('memoize-one/dist/memoize-one.cjs.js');

const colorProps = Array.from(allProperties).filter((prop) => prop.includes('color'));
const colorPropsSet = new Set(colorProps);

const parseCss1 = memoizeOne(_parseCss);
const parseCss2 = memoizeOne(_parseCss);
const normalizer1 = memoizeOne(_normalizer);
const normalizer2 = memoizeOne(_normalizer);

async function transform(inputCss, tailwindCss, options) {
    function isSubset(parent, child) {
        const a = omitIf(parent, isVariable);
        const b = omitIf(child, isVariable);
        if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
            return false;
        }
        return isMatchWith(a, b, (va, vb, key) => {
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
    function isSubset2(parent, child) {
        const a = omitIf(parent, isVariable);
        const b = omitIf(child, isVariable);
        if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
            return false;
        }
        return isMatchWith(a, b);
    }

    function filterTailwind(tailwindNormalized, inputNormalized, selector) {
        const cssMap = inputNormalized[selector];
        const filtered = Object.entries(tailwindNormalized)
            .filter(([twClass, value]) => {
                return isSubset(cssMap, value);
            })
            // remove repetitions
            .filter(([twClass, value], index, arr) => {
                for (let i = 0; i < index; i++) {
                    if (isEqual(arr[i][1], value)) {
                        return false;
                    }
                }
                return true;
            })
            // remove subsets
            .filter(([twClass, value], index, arr) => {
                for (let i = 0; i < index; i++) {
                    if (isSubset2(arr[i][1], value)) {
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

    const tailwindNormalized = normalizer1(await parseCss1(tailwindCss, true), options);
    const inputNormalized = normalizer2(await parseCss2(inputCss), options);

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

    return QUX;
}

module.exports = transform;
