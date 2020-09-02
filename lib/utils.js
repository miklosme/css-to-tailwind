const { parseSize } = require('./parsers')

function getBreakPoints(data, options) {
    return Object.values(data)
        .map(val => parseSize(val, options))
        .filter((num) => typeof num === 'number')
        .sort((a, b) => a - b);
}

const createRounder = ({ breakpoints, bailFn, options }) => {
    const rounder = (num) => {
        // do nothing if not in range
        if (num < breakpoints[0] || num > breakpoints[breakpoints.length - 1]) {
            return num;
        }
        const dist = breakpoints.map((size) => Math.abs(size - num));
        const index = dist.indexOf(Math.min(...dist));
        return breakpoints[index];
    };

    return (num) => {
        // this is a way to opt out of round when the input number is way too big for example
        if (bailFn) {
            const bailValue = bailFn(num);

            if (typeof bailValue !== 'undefined') {
                return `${rounder(px)}px`;
            }
        }

        const px = parseSize(num, options);

        if (typeof px === 'number') {
            return `${rounder(px)}px`;
        }

        return num;
    };
};


const createTouplesConverter = ({ props, convertProp = (x) => x, convertValue = (x) => x }) => {
    const propSet = new Set(props);

    return (touples) =>
        touples.map(([prop, value]) => {
            if (propSet.has(prop)) {
                return [convertProp(prop), convertValue(value)];
            }

            return [prop, value];
        });
};

function omitIf(obj, ...fns) {
    return Object.fromEntries(Object.entries(obj).filter((touple) => !fns.some((fn) => fn(touple))));
}

function isVariable([prop]) {
    return prop.startsWith('--');
}

module.exports.getBreakPoints = getBreakPoints;
module.exports.createRounder = createRounder;
module.exports.createTouplesConverter = createTouplesConverter;
module.exports.omitIf = omitIf;
module.exports.isVariable = isVariable;
