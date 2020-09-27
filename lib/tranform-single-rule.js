const { isVariable, omitIf } = require('./utils');
const isMatchWith = require('lodash.ismatchwith');
const isEqual = require('lodash.isequal');
const euclideanDistance = require('euclidean-distance');
const { parseColor } = require('./parsers');
const allProperties = require('cssstyle/lib/allProperties');

const colorProps = Array.from(allProperties).filter((prop) => prop.includes('color'));
const colorPropsSet = new Set(colorProps);

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

function transformSingleRule(variant, tailwindNormalized, inputNormalized) {
    return Object.keys(inputNormalized).map((selector) => {
        const resultTailwind = filterTailwind(tailwindNormalized, inputNormalized, selector);

        const tailwindClassesOrder = Object.fromEntries(
            Object.keys(tailwindNormalized).map((twClass, index) => [twClass, index]),
        );

        const resultArray = Object.keys(resultTailwind).sort(
            (a, z) => tailwindClassesOrder[a] - tailwindClassesOrder[z],
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

module.exports = transformSingleRule;
