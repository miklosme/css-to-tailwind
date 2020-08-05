const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const isMatch = require('lodash.ismatch');
const isEqual = require('lodash.isequal');
const __toPX = require('to-px');

function toNormalSize(v) {
    // patch the npm package
    if (v === '0') {
        return '0px';
    }

    if (knownNonPxConvertableValuesSet.has(v)) {
        return v; // do not throw
    }

    const px = __toPX(v);

    if (typeof px === 'number') {
        return `${roundSize(px)}px`;
    }

    throw new Error(`cannot convert ${v} to px`);
}

function normalizeToupleBySize([prop, value]) {
    if (sizePropsSet.has(prop)) {
        try {
            const converted = value
                .split(' ')
                .map((value) => toNormalSize(value))
                .join(' ');

            return [prop, converted];
        } catch (e) {
            console.log(e);
            return [prop, value];
        }
    }

    return [prop, value];
}

const sizePropsSet = new Set([
    'width',
    'height',
    'padding',
    'margin',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
]);

const knownNonPxConvertableValuesSet = new Set(['100%', 'auto', '100vh', '100vw']);

// TODO get this form tailwind config
const sizes = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 224, 256];

function roundSize(num) {
    // do nothing if not in range
    if (num < sizes[0] || num > sizes[sizes.length - 1]) {
        return num;
    }
    const dist = sizes.map((size) => Math.abs(size - num));
    const index = dist.indexOf(Math.min(...dist));
    return sizes[index];
}

// async function extractSingleClassNames(css) {
//     // const result = await parse(css);
//     // const classes = [];

//     // result.walkRules((rule) => {
//     //     if (rule.parent.type === 'root' && /^\.[a-z0-9-]+$/.test(rule.selector)) {
//     //         classes.push(rule.selector.slice(1));
//     //     }
//     // });

//     // return classes;

//     return Object.keys(await extractSingleClasses(css));
// }

async function classesRawJson(css) {
    const classNames = await extractSingleClassNames(css);
    // return slow_NormalizeClasses(css, classNames.slice(0, 10));
    return slow_NormalizeClasses(css, classNames);
}

function isSubset(parent, child) {
    if (isEqual(parent, child)) {
        return false;
    }
    const a = omitShorthands(parent);
    const b = omitShorthands(child);
    if (Object.keys(child).length === 0) {
        return false;
    }
    return isMatch(a, b);
}

// async function extractSingleClasses(css) {
//     const ast = await parse(css);
//     const result = {};
//     ast.walkRules((rule) => {
//         if (rule.parent.type === 'root' && /^\.[a-z0-9-]+$/.test(rule.selector)) {
//             const selector = rule.selector.slice(1);
//             rule.walkDecls((decl) => {
//                 if (!result[selector]) {
//                     result[selector] = [];
//                 }
//                 result[selector].push([decl.prop, decl.value]);
//             });
//         }
//     });
//     return result;
// }

function touplesToCssDict(touples) {
    return touples.map(([prop, value]) => `${prop}: ${value}`).join(';');
}

// function slow_NormalizeClasses(css, classNames) {
//     const elements = classNames.map((tc) => `<div class="${tc}" />`).join('');
//     const html = `<!DOCTYPE html><style>${css}</style>${elements}`;
//     const dom = new JSDOM(html);

//     return classNames.reduce((acc, className, index, arr) => {
//         console.log(className, index, '/', arr.length - 1);
//         const main = dom.window.document.querySelector(`.${className}`);
//         const computedStyle = dom.window.getComputedStyle(main);
//         debugger;
//         const { display, visibility, ...normalized } = computedStyle._values;

//         return {
//             ...acc,
//             [className]: normalized,
//         };
//     }, {});
// }

// async function classesNormalizedJson(css) {
//     const singleClassesJson = await extractSingleClasses(css);
//     const normalized = Object.fromEntries(
//         Object.entries(singleClassesJson)
//             // .slice(0, 10)
//             .map(([twClass, touples], index, arr) => {
//                 console.log(twClass, index, '/', arr.length - 1);
//                 return [twClass, extendCssJsonWithNormalized(touples)];
//             })
//             .map(([twClass, touples]) => [twClass, omitShorthands(touples)]),
//     );
// }
// async function classesRawJson(css) {
//     const singleClassesJson = await extractSingleClasses(css);

//     const html = `<!DOCTYPE html><style>#test{${touplesToCssDict(touples)}}</style><div id="test" />`;
//     const dom = new JSDOM(html);

//     const main = dom.window.document.querySelector('#test');
//     const computedStyle = dom.window.getComputedStyle(main);
//     const { display, visibility, ...normalized } = computedStyle._values;

//     return normalized;
// }

async function parseSingleClasses(css) {
    const ast = await parse(css);
    const result = {};
    ast.walkRules((rule) => {
        if (rule.parent.type === 'root' && /^\.[a-z0-9-]+$/.test(rule.selector)) {
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

function extendCssJsonWithNormalized(touples) {
    const html = `<!DOCTYPE html><style>#test{${touplesToCssDict(touples)}}</style><div id="test" />`;
    const dom = new JSDOM(html);

    const main = dom.window.document.querySelector('#test');
    const computedStyle = dom.window.getComputedStyle(main);
    const { display, visibility, ...normalized } = computedStyle._values;

    const inputAsObject = Object.fromEntries(touples);

    const sizeNormalized = Object.fromEntries(Object.entries(normalized).map(normalizeToupleBySize));

    return { ...inputAsObject, ...sizeNormalized };
}

function omitShorthands(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([prop, value]) => !value.includes(' ')));
}

async function normalizeSingleClasses(css) {
    const singleClassesJson = await parseSingleClasses(css);

    return Object.fromEntries(
        Object.entries(singleClassesJson)
            // .slice(0, 10)
            .map(([twClass, touples]) => [twClass, extendCssJsonWithNormalized(touples)]),
        // .map(([twClass, touples]) => [twClass, omitShorthands(touples)]),
    );
}

function filterTailwind(normalizedTailwind, normalizedCssMap) {
    const resultEntries = Object.entries(normalizedTailwind)
        .filter(([twClass, value], index) => {
            return isSubset(normalizedCssMap, value);
        })
        // remove redundants
        .filter(([twClass, value], index, arr) => {
            for (let i = 0; i < arr.length; i++) {
                if (i === index) {
                    continue;
                }
                if (isSubset(arr[i][1], value)) {
                    return false;
                }
            }
            return true;
        });

    const result = Object.fromEntries(resultEntries);

    const resultMap = Object.keys(
        resultEntries.reduce(
            (acc, [twClass, map]) => ({
                ...acc,
                ...map,
            }),
            {},
        ),
    );

    const meta = {
        missing: Object.keys(normalizedCssMap).filter((prop) => !resultMap.includes(prop)),
    };

    return {
        result,
        meta,
    };
}

(async () => {
    const css = await fs.readFile('./tailwind.css', 'utf8');

    const tailwindRaw = await extractSingleClasses(css);
    // const tailwindRaw = JSON.parse(await fs.readFile('./tailwind.raw.json', 'utf8'));
    await fs.writeFile('./tailwind.raw.json', JSON.stringify(tailwindRaw, null, 2), 'utf8');

    const tailwindNormalized = await normalizeSingleClasses(css);
    // const tailwindNormalized = JSON.parse(await fs.readFile('./tailwind.normalized.json', 'utf8'));
    await fs.writeFile('./tailwind.normalized.json', JSON.stringify(tailwindNormalized, null, 2), 'utf8');

    // ////////

    const alertCss = `.alert {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #e5e5e5;
        color: #fff;
        border-radius: 0.2rem;
        width: 100%;
      } `;

    const { alert: alertJsonNormalized } = await normalizeSingleClasses(alertCss);

    // ///////////

    const { result, meta } = filterTailwind(tailwindNormalized, alertJsonNormalized);

    console.log('alertJsonNormalized', alertJsonNormalized);
    console.log();
    console.log('====');
    console.log('Results:', result);
    console.log('Tailwind classes:', Object.keys(result));
    console.log('Missing:', meta.missing);

    /*
        # Problems

        - sizes
        - colors

        ## TODO

        - fix "meta.missing"
        - default font size to convert rem to px
        - normalize colors https://www.npmjs.com/package/css-color-converter#torgbaarray
        - color distance
    */

    // //////////

    // const shorthands = {};

    // Object.entries(tailwindJson).forEach(([twClass, map]) => {
    //     Object.entries(map).forEach(([prop, value]) => {
    //         if (value.includes(' ')) {
    //             // console.log(prop, value);
    //             if (!shorthands[prop]) {
    //                 shorthands[prop] = []
    //             }
    //             shorthands[prop].push(value)
    //         }
    //     });
    // });

    // console.log(shorthands);
})();

// result.walkRules((rule) => {
//   if (rule.parent.type === "root" && /^\.[a-z0-9-]+$/.test(rule.selector)) {
//     json[rule.selector] = [];
//     rule.walkDecls((decl) => {
//       json[rule.selector].push([decl.prop, decl.value]);
//     });
//   }
// });
