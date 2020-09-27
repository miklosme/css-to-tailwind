const transformSingleRule = require('./tranform-single-rule');
const { parseCss: _parseCss, parseTailwindCss: _parseTailwindCss } = require('./parsers');
const _normalizer = require('./normalizer');
const { getOptions } = require('./options');
const memoizeOne = require('memoize-one/dist/memoize-one.cjs.js');

const parseTailwindCss = memoizeOne(_parseTailwindCss);
const parseInputCss = memoizeOne(_parseCss);

// need different instances, because they are running together
const normalizer1 = memoizeOne(_normalizer);
const normalizer2 = memoizeOne(_normalizer);

async function transform(inputCss, tailwindCss) {
    // `options` only used for cache invalidation here
    const options = getOptions();
    const tailwindNormalized = normalizer1(await parseTailwindCss(tailwindCss), options);
    const inputNormalized = normalizer2(await parseInputCss(inputCss), options);

    const variantsMerged = Object.entries(inputNormalized)
        .flatMap(([variant, inputNormalized]) => {
            const singleVariantNormalized = tailwindNormalized[variant];

            if (!singleVariantNormalized) {
                throw new Error(`unknown variant in Tailwind: "${variant}"`);
            }

            return transformSingleRule(variant, singleVariantNormalized, inputNormalized);
        })
        .reduce((acc, curr) => {
            if (!acc[curr.selector]) {
                acc[curr.selector] = [];
            }
            acc[curr.selector].push(curr);
            return acc;
        }, {});

    return Object.values(variantsMerged).map((results) => {
        return results.reduce((acc, curr) => {
            return {
                selector: curr.selector,
                tailwind: acc.tailwind ? acc.tailwind.concat(' ', curr.tailwind) : curr.tailwind,
                missing: acc.missing ? { ...acc.missing, ...curr.missing } : curr.missing,
            };
        });
    });
}

module.exports = transform;
