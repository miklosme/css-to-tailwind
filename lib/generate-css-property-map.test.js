const generateCssPropertyMap = require('./generate-css-property-map');

test('generateCssPropertyMap works', async () => {
    expect(await generateCssPropertyMap()).toMatchSnapshot();
})