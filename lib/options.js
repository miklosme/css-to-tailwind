const merge = require('lodash.merge');
const memoize = require('memoize-one/dist/memoize-one.cjs.js');
const defaultOptions = require('./default-options');

let packageOptions = merge({}, defaultOptions);

// memoizing this will help with the memoization of other functions
const setOptions = memoize((options) => {
    packageOptions = merge(packageOptions, options);
    return packageOptions;
});

function getOptions() {
    return packageOptions;
}

module.exports.getOptions = getOptions;
module.exports.setOptions = setOptions;
