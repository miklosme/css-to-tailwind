const parseSelector = require('postcss-selector-parser');
const cssColorConverter = require('css-color-converter');

function parseColor(color) {
    const rgba = cssColorConverter(color).toRgbaArray();
    if (Array.isArray(rgba) && rgba.length === 4) {
        return rgba;
    }
    return null;
}

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

const responsiveBreakpoints = {
    640: 'sm',
    768: 'md',
    1024: 'lg',
    1280: 'xl',
};

function getVariantFromSelector(selector, mediaRuleValue) {
    const all = [];
    parseSelector((selectors) => {
        selectors.walk((selector) => {
            if (selector.type !== 'selector') {
                all.push(selector);
            }
        });
    }).processSync(selector);

    let variants = [];

    if (mediaRuleValue) {
        const matchResult = mediaRuleValue.match(/\(min-width:\s(\d+)px\)/);
        if (matchResult) {
            const minWidth = Number(matchResult[1]);

            if (typeof minWidth === 'number') {
                // TODO get this from config
                if (!responsiveBreakpoints[minWidth]) {
                    throw new Error('unsupported media query');
                }
                variants.push(responsiveBreakpoints[minWidth]);
            }
        }
    }

    const baseSelector = [];
    let isProcessingPseudosOfFirstElement = true;

    for (let i = all.length - 1; i >= 0; i--) {
        let value = all[i].value;

        if (isProcessingPseudosOfFirstElement) {
            if (all[i].type === 'pseudo') {
                if (value.includes('hover')) {
                    variants.push('hover');
                    continue;
                } else if (value.includes('focus')) {
                    variants.push('focus');
                    continue;
                } else if (value.includes('placeholder')) {
                    variants.push('placeholder');
                    continue;
                }
            } else {
                isProcessingPseudosOfFirstElement = false;
            }
        }

        if (all[i].type === 'class') {
            value = `.${value}`;
        } else if (all[i].type === 'id') {
            value = `#${value}`;
        }

        baseSelector.push(value);
    }
    return {
        variants: variants.length ? variants : ['default'],
        baseSelector: baseSelector.reverse().join(''),
    };
}

module.exports.parseColor = parseColor;
module.exports.createTouplesConverter = createTouplesConverter;
module.exports.getVariantFromSelector = getVariantFromSelector;
