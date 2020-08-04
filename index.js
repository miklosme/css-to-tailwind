const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const isMatch = require('lodash.ismatch');

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

// async function classesRawJson(css) {
//     const classNames = await extractSingleClassNames(css);
//     // return slow_NormalizeClasses(css, classNames.slice(0, 10));
//     return slow_NormalizeClasses(css, classNames);
// }

// function isSubset(parent, child) {
//     const a = omitShorthands(parent);
//     const b = omitShorthands(child);
//     if (Object.keys(child).length === 0) {
//         return false;
//     }
//     return isMatch(a, b);
// }

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
//                 return [twClass, normalizeCssJson(touples)];
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

function normalizeCssJson(touples) {
    const html = `<!DOCTYPE html><style>#test{${touplesToCssDict(touples)}}</style><div id="test" />`;
    const dom = new JSDOM(html);

    const main = dom.window.document.querySelector('#test');
    const computedStyle = dom.window.getComputedStyle(main);
    const { display, visibility, ...normalized } = computedStyle._values;

    return normalized;
}

function omitShorthands(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([prop, value]) => !value.includes(' ')));
}

async function normalizeSingleClasses(css) {
    const singleClassesJson = await parseSingleClasses(css);

    return Object.fromEntries(
        Object.entries(singleClassesJson)
            // .slice(0, 10)
            .map(([twClass, touples], index, arr) => {
                console.log(twClass, index, '/', arr.length - 1);
                return [twClass, normalizeCssJson(touples)];
            })
            .map(([twClass, touples]) => [twClass, omitShorthands(touples)]),
    );
}

(async () => {
    const css = await fs.readFile('./tailwind.css', 'utf8');

    const tailwindRaw = await extractSingleClasses(css);
    await fs.writeFile('./tailwind.raw.json', JSON.stringify(tailwindRaw, null, 2), 'utf8');

    const tailwindNormalized = await normalizeSingleClasses(css);
    await fs.writeFile('./tailwind.normalized.json', JSON.stringify(tailwindNormalized, null, 2), 'utf8');

    // ///////////

    // const inputJson = await classesRawJson(`.alert {
    //     position: relative;
    //     padding: 1.6rem 4.6rem;
    //     margin-bottom: 1.6rem;
    //     border: 1px solid #e5e5e5;
    //     border-radius: 0.2rem;
    //     width: 100%;
    //   } `);

    // const result = Object.entries(tailwindJson)
    //     .filter(([twClass, value]) => {
    //         return isSubset(inputJson['alert'], value);
    //     })
    //     .map(([twClass]) => twClass);

    // console.log(result);

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
