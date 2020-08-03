const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const isMatch = require('lodash.ismatch');

function normalizeClasses(css, classNames) {
    const elements = classNames.map((tc) => `<div class="${tc}" />`).join('');
    const dom = new JSDOM(`<!DOCTYPE html><style>${css}</style>${elements}`);

    return classNames.reduce((acc, className) => {
        console.log(className);
        const main = dom.window.document.querySelector(`.${className}`);
        const computedStyle = dom.window.getComputedStyle(main);
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
    return normalizeClasses(css, classNames.slice(0,10));
}

(async () => {
    const css = await fs.readFile('./tailwind.css', 'utf8');
    const tailwindJson = await classesJson(css);

    const inputJson = await classesJson(`.alert {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #e5e5e5;
        border-radius: 0.2rem;
        width: 100%;
      } `);

    console.log(tailwindJson);
    console.log(inputJson);
    debugger;
})();

// result.walkRules((rule) => {
//   if (rule.parent.type === "root" && /^\.[a-z0-9-]+$/.test(rule.selector)) {
//     json[rule.selector] = [];
//     rule.walkDecls((decl) => {
//       json[rule.selector].push([decl.prop, decl.value]);
//     });
//   }
// });
