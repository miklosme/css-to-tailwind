const { isVariable, omitIf } = require('./utils');
const isMatchWith = require('lodash.ismatchwith');
const isEqual = require('lodash.isequal');
const euclideanDistance = require('euclidean-distance');
const { parseColor } = require('./parsers');
const { getOptions } = require('./options');

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
            return distance < getOptions().COLOR_DELTA;
        }

        return undefined;
    });
}

function isRedundant(parent, child) {
    if (isEqual(parent, child)) {
        return true;
    }

    const a = omitIf(parent, isVariable);
    const b = omitIf(child, isVariable);
    if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
        return false;
    }
    return isMatchWith(a, b);
}

function filterTailwind(tailwindNormalized, inputNormalized, selector) {
    const cssMap = inputNormalized[selector];
    const matches = Object.entries(tailwindNormalized).filter(([twClass, value]) => isSubset(cssMap, value));

    const pairs = [];

    for (let i = 0; i < matches.length; i++) {
        for (let j = 0; j < i; j++) {
            pairs.push([i, j], [j, i]);
        }
    }

    const dropped = new Set();

    // compares all result classes with each other, to remove redundancies
    // for example "mt-20, mr-20, mb-20, ml-20" are all redundant if m-20 is also a result
    pairs.forEach(([aIndex, bIndex]) => {
        if (dropped.has(bIndex)) {
            return;
        }

        if (isRedundant(matches[aIndex][1], matches[bIndex][1])) {
            dropped.add(bIndex);
        }
    });

    const filtered = matches.filter((_, index) => !dropped.has(index))

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
