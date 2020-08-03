const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');

async function listTailwindClasses(css) {
    const result = await parse(css);
    const classes = [];

    result.walkRules((rule) => {
        if (rule.parent.type === 'root' && /^\.[a-z0-9-]+$/.test(rule.selector)) {
            classes.push(rule.selector.slice(1));
        }
    });

    return classes;
}

function normalizeTailwindClasses(css, tailwindClasses) {
    const elements = tailwindClasses.map((tc) => `<div class="${tc}" />`).join('');
    const dom = new JSDOM(`<!DOCTYPE html><style>${css}</style>${elements}`);

    return tailwindClasses.slice(0, 10).reduce((acc, tailwindClass) => {
        console.log(tailwindClass);
        const main = dom.window.document.querySelector(`.${tailwindClass}`);
        const computedStyle = dom.window.getComputedStyle(main);
        const { display, visibility, ...normalized } = computedStyle._values;

        return {
            ...acc,
            [tailwindClass]: normalized,
        };
    }, {});
}

async function tailwindJson(css) {
    const tailwindClasses = await listTailwindClasses(css);
    return normalizeTailwindClasses(css, tailwindClasses);
}

(async () => {
    const css = await fs.readFile('./tailwind.css', 'utf8');
    const result = await tailwindJson(css);

    console.log(result);
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
