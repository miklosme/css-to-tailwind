const parse = require("postcss-safe-parser");
const fs = require("fs").promises;
const { JSDOM } = require("jsdom");

async function tailwindClasses(css) {
//   const result = await parse(`.foo{border:1px solid red}`);
  const result = await parse(css);

  const json = {};

  result.walkRules((rule) => {
    let item = null;

    if (rule.parent.type === "root" && /^\.[a-z0-9-]+$/.test(rule.selector)) {
      json[rule.selector] = [];
      rule.walkDecls((decl) => {
        json[rule.selector].push([decl.prop, decl.value]);
      });
    }
  });

  return json;
}

// these are not relevant for us, but they are always there in the computed style
function noJunkProps(key) {
  return key !== "display" && key !== "visibility";
}

function computeClass(touples) {
  const css = touples.map(([prop, val]) => `${prop}: ${val}`).join(";");
  const dom = new JSDOM(
    `<!DOCTYPE html><style>#test{${css}}</style><p id="test">Hello world</p>`
  );
  const main = dom.window.document.querySelector("#test");
  const computedStyle = dom.window.getComputedStyle(main);
  return Object.fromEntries(
    Object.entries(computedStyle._values).filter(noJunkProps)
  );
}

(async () => {
  const css = await fs.readFile("./tailwind.css", "utf8");
  const tailwindJson = await tailwindClasses(css);

  const result = Object.fromEntries(
    Object.entries(tailwindJson)
      .map(([tailwindClass, touples]) => {
        return [tailwindClass, computeClass(touples)];
      })
  );

  console.log(result);
  debugger;
})();

// import * as postcss from 'postcss';

// export default postcss.plugin('postcss-reverse-props', (options = {}) => {
//     // Work with options here
//     return root => {
//         // Transform CSS AST here
//         root.walkRules(rule => {
//             // Transform each rule here
//             rule.walkDecls(decl => {
//                 // Transform each property declaration here
//                 decl.prop = decl.prop.split('').reverse().join('');
//             });
//         });
//     };
// });
