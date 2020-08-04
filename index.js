const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const isMatch = require('lodash.ismatch');

function normalizeClasses(css, classNames) {
    const elements = classNames.map((tc) => `<div class="${tc}" />`).join('');
    const html = `<!DOCTYPE html><style>${css}</style>${elements}`;
    const dom = new JSDOM(html);

    return classNames.reduce((acc, className, index, arr) => {
        console.log(className, index, '/', arr.length - 1);
        const main = dom.window.document.querySelector(`.${className}`);
        const computedStyle = dom.window.getComputedStyle(main);
        debugger;
        const { display, visibility, ...normalized } = computedStyle._values;

        return {
            ...acc,
            [className]: normalized,
        };
    }, {});
}

async function extractClassNames(css) {
    const result = await parse(css);
    const classes = [];

    result.walkRules((rule) => {
        if (rule.parent.type === 'root' && /^\.[a-z0-9-]+$/.test(rule.selector)) {
            classes.push(rule.selector.slice(1));
        }
    });

    return classes;
}

async function classesJson(css) {
    const classNames = await extractClassNames(css);
    // return normalizeClasses(css, classNames.slice(0, 10));
    return normalizeClasses(css, classNames);
}

function omitShorthands(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([prop, value]) => !value.includes(' ')));
}

function isSubset(parent, child) {
    const a = omitShorthands(parent);
    const b = omitShorthands(child);
    console.log(a, b);
    return isMatch(a, b);
}

(async () => {
    // const css = await fs.readFile('./tailwind.css', 'utf8');
    // const tailwindJson = await classesJson(css);
    // await fs.writeFile('./tailwind.json', JSON.stringify(tailwindJson, null, 2), 'utf8');

    const tailwindJson = JSON.parse(await fs.readFile('./tailwind.json', 'utf8'));
    const inputJson = await classesJson(`.alert {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #e5e5e5;
        border-radius: 0.2rem;
        width: 100%;
      } `);

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

    const result = Object.entries(tailwindJson)
    .slice(0,1)
        .filter(([twClass, value]) => {
            return isSubset(inputJson['alert'], value);
        })
        .map(([twCLass]) => twClass);

    console.log(result);
})();

// result.walkRules((rule) => {
//   if (rule.parent.type === "root" && /^\.[a-z0-9-]+$/.test(rule.selector)) {
//     json[rule.selector] = [];
//     rule.walkDecls((decl) => {
//       json[rule.selector].push([decl.prop, decl.value]);
//     });
//   }
// });
