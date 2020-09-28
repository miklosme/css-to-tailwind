const cssToTailwind = require('./css-to-tailwind');
const path = require('path');
const testData = require('./fixtures/test-data');

test('cssToTailwind', async () => {
    const results = await cssToTailwind(testData.plainCss);

    expect(results).toHaveLength(15);
    expect(results.filter((res) => Object.keys(res.missing).length)).toHaveLength(10);
    expect(results).toMatchSnapshot();
});

test('cssToTailwind with custom tailwind config', async () => {
    const results = await cssToTailwind(`div { background: #4D4D4D }`, {
        TAILWIND_CONFIG: require(path.resolve(process.cwd(), 'fixtures/tailwind.config.js')),
        COLOR_DELTA: 5,
    });

    expect(results[0].tailwind).toBe('bg-neutral-700');
    expect(results).toMatchInlineSnapshot(`
        Array [
          Object {
            "missing": Object {},
            "selector": "div",
            "tailwind": "bg-neutral-700",
          },
        ]
    `);
});

test('cssToTailwind supports variants', async () => {
    const results = await cssToTailwind(testData.cssWithVariants);
    expect(results.map((r) => ({ selector: r.selector, tailwind: r.tailwind }))).toMatchInlineSnapshot(`
        Array [
          Object {
            "selector": ".baz",
            "tailwind": "bg-no-repeat py-6 px-20",
          },
          Object {
            "selector": ".foo",
            "tailwind": "rounded border-solid border mb-6 py-6 px-20 relative text-white w-full",
          },
          Object {
            "selector": ".bar",
            "tailwind": "py-6 px-20 relative xl:mb-10 xl:py-12 xl:px-24",
          },
        ]
    `);
});

test('result does not contain redundant classes', async () => {
    const results = await cssToTailwind(`.foo {
      padding: 1.6rem;
    }`);

    expect(results[0].tailwind).toBe('p-6');
});

test('selector should correctly handle comma operator', async () => {
    const results = await cssToTailwind(`a, b {
    padding: 1.6rem;
  }`);

    expect(results[0].selector).toBe('a, b');
});

test('result does not contain unsupported classes', async () => {
    const results = await cssToTailwind(`.foo {
      width: 50%;
    }`);

    expect(results[0].tailwind).toBe('w-1/2');
});

test('result have variants merged', async () => {
    const results = await cssToTailwind(`.foo {
      padding: 1.6rem;
    }
    
    .foo:hover {
      background: transparent;
    }`);

    expect(results).toMatchInlineSnapshot(`
        Array [
          Object {
            "missing": Object {},
            "selector": ".foo",
            "tailwind": "p-6 hover:bg-transparent",
          },
        ]
    `);
});

test('result have missing variants values', async () => {
    const results = await cssToTailwind(`.foo:hover {
      padding: 2.6rem;
    }`);

    expect(results).toMatchInlineSnapshot(`
        Array [
          Object {
            "missing": Object {
              "hover": Array [
                Array [
                  "padding-top",
                  "40px",
                ],
                Array [
                  "padding-right",
                  "40px",
                ],
                Array [
                  "padding-bottom",
                  "40px",
                ],
                Array [
                  "padding-left",
                  "40px",
                ],
              ],
            },
            "selector": ".foo",
            "tailwind": "",
          },
        ]
    `);
});

test('custom spacing should be correctly represented in results', async () => {
    const input = `
      .foo {
          padding: 4rem;
      }`;

    const results = await cssToTailwind(input, {
        TAILWIND_CONFIG: {
            theme: {
                spacing: {
                    '36': '36px',
                    '72': '72px',
                    '144': '144px',
                },
            },
        },
    });

    expect(results[0].tailwind).toBe('p-72');
    expect(results).toMatchInlineSnapshot(`
        Array [
          Object {
            "missing": Object {},
            "selector": ".foo",
            "tailwind": "p-72",
          },
        ]
    `);
});

test('custom utility classes defined in preprocessor input should be used', async () => {
    const inputCss = `div {
      background: #81e6d9;
      padding: 1.6rem 4.6rem;
      letter-spacing: 0.03rem;
      border-radius: 0.2rem;
    }`;

    const preprocessInput = `
      @tailwind base;
      
      @tailwind components;
      
      @tailwind utilities;

      .button {
        @apply bg-teal-300 rounded py-6 px-20 tracking-wide
      }
    `;

    const results = await cssToTailwind(inputCss, {
        PREPROCESSOR_INPUT: preprocessInput,
    });
    
    expect(results[0].tailwind).toBe('button');
});
