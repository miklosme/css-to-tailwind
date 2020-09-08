const cssToTailwind = require('./css-to-tailwind');
const path = require('path');

const inputCss = `
      .alert {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #FAD0D0;
        color: #fff;
        border-radius: 0.2rem;
        width: 100%;
      } 
      
      .guest-layout__logo {
        margin-bottom: 1.6rem;
        min-height: 4rem;
        display: flex;
        justify-content: center;
      }
      
      .guest-layout__container {
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 0.2rem;
      } 
      
      .guest-layout {
        margin: 8rem auto;
        max-width: fit-content;
      }
      
      .guest-layout__header {
        font-weight: 400;
        font-size: 2rem;
        line-height: 3rem;
        letter-spacing: 0.03rem;
        padding: 2.4rem;
        border-bottom: 1px solid #e5e5e5;
      }
      
      .guest-layout__footer {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-direction: row-reverse;
        padding: 2.4rem 3rem;
        border-top: 1px solid #e5e5e5;
      }
      
      .guest-layout__footer--compact {
        border: none;
        padding: 0;
        margin-top: 1.6rem;
      }
      
      .guest-layout__content {
        display: flex;
        flex-wrap: nowrap;
        width: 38rem;
      }
      
      .guest-layout__content--with-side-content {
        width: 76rem;
      }
      .guest-layout__content--with-side-contentdfdf {
        width: 50%;
      }
      
      .guest-layout__content--with-side-contentdfdf {
        width: 50%;
      }
      .guest-layout__content--with-separatordfdfdf{
        border-right: 1px solid #e5e5e5;
      }
      .guest-layout__content-inner {
        width: 100%;
        display: flex;
        justify-content: center;
        flex-direction: column;
        margin: 0;
        padding: 3rem;
      }
      
      .guest-layout__content--with-separatordfdf {
        background: unset;
      }
      .guest-layout__side-content {
        width: 50%;
        background: #e3e6e6;
        padding: 3rem;
        display: flex;
        justify-content: center;
        flex-direction: column;
      }
      .guest-layout__dfdfdfdf {
        margin-top: 0;
      }
    `;

test('cssToTailwind', async () => {
    const results = await cssToTailwind(inputCss);

    expect(results).toHaveLength(15);
    expect(results.filter((res) => Object.keys(res.missing).length)).toHaveLength(10);
    expect(results).toMatchSnapshot();
});

test('cssToTailwind with custom tailwind config', async () => {
    const results = await cssToTailwind(inputCss, {
        TAILWIND_CONFIG: require(path.resolve(process.cwd(), 'fixtures/tailwind.config.js')),
        COLOR_DELTA: 5,
    });

    expect(results).toHaveLength(15);
    expect(results.filter((res) => Object.keys(res.missing).length)).toHaveLength(5);
    expect(results).toMatchSnapshot();
});

test('result does not contain redundant classes', async () => {
    const results = await cssToTailwind(`.foo {
      padding: 1.6rem;
    }`);

    expect(results[0].tailwind).toBe('p-6');
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
