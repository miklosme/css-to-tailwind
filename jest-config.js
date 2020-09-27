const { setOptions } = require('./lib/options');
const defaultOptions = require('./lib/default-options');

beforeEach(() => {
    setOptions(defaultOptions);
});
