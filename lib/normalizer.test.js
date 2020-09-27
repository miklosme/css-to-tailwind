const { parseCss } = require('./parsers');
const { createRounder } = require('./utils');
const normalizer = require('./normalizer');
const { setOptions } = require('./options');

const { getVariantFromSelector } = normalizer;

test('normalizer should handle custom spacing', async () => {
    setOptions({
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

    const parsedCss = await parseCss(`
        div {
            padding: 4rem;
        }
    `);
    const normalizedCss = normalizer(parsedCss);

    expect(normalizedCss.base.div['padding-bottom']).not.toBe('64px'); // default config value
    expect(normalizedCss.base.div['padding-bottom']).toBe('72px');
    expect(normalizedCss).toMatchInlineSnapshot(`
        Object {
          "base": Object {
            "div": Object {
              "padding-bottom": "72px",
              "padding-left": "72px",
              "padding-right": "72px",
              "padding-top": "72px",
            },
          },
        }
    `);
});

const responsiveBreakpointNames = {
    640: 'sm',
    768: 'md',
    1024: 'lg',
    1280: 'xl',
};

const breakpointRounder = createRounder({
    breakpoints: Object.keys(responsiveBreakpointNames).sort((a, z) => a - z),
});

// TODO test variantsKey
test.each([
    ['div', null, { baseSelector: 'div', variants: [] }],
    ['div:hover', null, { baseSelector: 'div', variants: ['hover'] }],
    ['.foo:focus', null, { baseSelector: '.foo', variants: ['focus'] }],
    ['.bar::placeholder', null, { baseSelector: '.bar', variants: ['placeholder'] }],
    ['.baz:focus::placeholder', null, { baseSelector: '.baz', variants: ['focus', 'placeholder'] }],
    ['.foo::-ms-input-placeholder', null, { baseSelector: '.foo', variants: ['placeholder'] }],
    ['.foo::-moz-placeholder', null, { baseSelector: '.foo', variants: ['placeholder'] }],
    [
        'div p >.foo .bar:hover #id .baz:focus::placeholder',
        null,
        { baseSelector: 'div p > .foo .bar:hover #id .baz', variants: ['focus', 'placeholder'] },
    ],
    ['   p    div:hover    ', null, { baseSelector: 'p div', variants: ['hover'] }],
    ['.foo', '(min-width: 640px)', { baseSelector: '.foo', variants: ['sm'] }],
    ['.foo', '(min-width: 768px)', { baseSelector: '.foo', variants: ['md'] }],
    ['.foo', '(min-width: 1024px)', { baseSelector: '.foo', variants: ['lg'] }],
    ['.foo', '(min-width: 1280px)', { baseSelector: '.foo', variants: ['xl'] }],
    ['.foo:hover', '(min-width: 1280px)', { baseSelector: '.foo', variants: ['xl', 'hover'] }],
])("getVariantFromSelector('%s', '%s')", (selector, mediaRuleValue, expected) => {
    const { baseSelector, variants } = getVariantFromSelector({
        selector,
        mediaRuleValue,
        responsiveBreakpointNames,
        breakpointRounder,
    });
    expect(baseSelector).toEqual(expected.baseSelector);
    expect(variants).toEqual(expected.variants);
});

test('getVariantFromSelector should round breakpoints', () => {
    const { variants } = getVariantFromSelector({
        selector: '.foo',
        mediaRuleValue: '(min-width: 700px)',
        responsiveBreakpointNames,
        breakpointRounder,
    });
    expect(variants).toEqual(['sm']);
});

test('getVariantFromSelector should handle complex atrule media params', () => {
    const { variants } = getVariantFromSelector({
        selector: '.foo',
        mediaRuleValue: 'all and (min-width: 1111px) and print',
        responsiveBreakpointNames,
        breakpointRounder,
    });
    expect(variants).toEqual(['lg']);
});
