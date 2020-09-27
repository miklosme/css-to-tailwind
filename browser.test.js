const postCss = require('postcss');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');
const cssToTailwind = require('./browser');

test('browser version works', async () => {
    const { css: tailwindCss } = await postCss([
        postCssTailwind,
        postCssAutoprefixer,
    ]).process('@tailwind base;\n\n@tailwind components;\n\n@tailwind utilities;', { from: 'tailwind.css' });

    const inputCss = `
        .foo {
            padding: 1.6rem;
        }
        
        .foo:hover {
            background: transparent;
        }`;

    const result = await cssToTailwind(inputCss, tailwindCss);

    expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            "missing": Object {},
            "selector": ".foo",
            "tailwind": "p-6 hover:bg-transparent",
          },
        ]
    `);
});

test('browser version throws when tailwind.css is not provided', async () => {
    await expect(cssToTailwind('')).rejects.toThrowErrorMatchingInlineSnapshot(
        `"You are using the browser package, but did not provide the \`tailwind.css\` content. Browser use-cases are reponsible to build \`tailwind.css\` themselves."`,
    );
});
