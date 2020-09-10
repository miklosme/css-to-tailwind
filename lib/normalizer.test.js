const { getVariantFromSelector } = require('./normalizer');

test.each([
    ['div', null, { baseSelector: 'div', variants: ['default'] }],
    ['div:hover', null, { baseSelector: 'div', variants: ['hover'] }],
    ['.foo:focus', null, { baseSelector: '.foo', variants: ['focus'] }],
    ['.bar::placeholder', null, { baseSelector: '.bar', variants: ['placeholder'] }],
    ['.baz:focus::placeholder', null, { baseSelector: '.baz', variants: ['placeholder', 'focus'] }],
    ['.foo::-ms-input-placeholder', null, { baseSelector: '.foo', variants: ['placeholder'] }],
    ['.foo::-moz-placeholder', null, { baseSelector: '.foo', variants: ['placeholder'] }],
    [
        'div p > .foo .bar:hover #id .baz:focus::placeholder',
        null,
        { baseSelector: 'div p>.foo .bar:hover #id .baz', variants: ['placeholder', 'focus'] },
    ],
    ['   p    div:hover    ', null, { baseSelector: 'p div', variants: ['hover'] }],
    ['.foo', '(min-width: 640px)', { baseSelector: '.foo', variants: ['sm'] }],
    ['.foo', '(min-width: 768px)', { baseSelector: '.foo', variants: ['md'] }],
    ['.foo', '(min-width: 1024px)', { baseSelector: '.foo', variants: ['lg'] }],
    ['.foo', '(min-width: 1280px)', { baseSelector: '.foo', variants: ['xl'] }],
    ['.foo:hover', '(min-width: 1280px)', { baseSelector: '.foo', variants: ['xl', 'hover'] }],
])("getVariantFromSelector('%s', '%s')", (selector, mediaRuleValue, expected) => {
    const { baseSelector, variants } = getVariantFromSelector(selector, mediaRuleValue);
    expect(baseSelector).toEqual(expected.baseSelector);
    expect(variants).toEqual(expected.variants);
});
