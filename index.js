const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { CSSStyleDeclaration } = require("cssstyle");
const isMatch = require('lodash.ismatch');
const isEqual = require('lodash.isequal');
const parseSize = require('to-px');
const parseColor = require('css-color-converter');

function toNormalSize(v) {
    // patch the npm package
    if (v === '0') {
        return '0px';
    }

    if (knownNonPxConvertableValuesSet.has(v)) {
        return v; // do not throw
    }

    const px = parseSize(v);

    if (typeof px === 'number') {
        return `${roundSize(px)}px`;
    }

    throw new Error(`cannot convert ${v} to px`);
}

function normalizeToupleBySize([prop, value]) {
    if (sizePropsSet.has(prop)) {
        try {
            const converted = value
                .split(' ')
                .map((value) => toNormalSize(value))
                .join(' ');

            return [prop, converted];
        } catch (e) {
            console.log(e);
            return [prop, value];
        }
    }

    return [prop, value];
}

function normalizeTouplesBySize(touples) {
    return touples.map(normalizeToupleBySize);
}

const sizePropsSet = new Set([
    'width',
    'height',
    'padding',
    'margin',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
]);

function normalizeTouplesByColor(touples) {
    return touples.map(([prop, value]) => {
        if (colorPropsSet.has(prop)) {
            const rgba = parseColor(value).toRgbaArray();
            if (Array.isArray(rgba) && rgba.length === 4) {
                return [prop, `rgba(${rgba.join(', ')})`];
            }
        }

        return [prop, value];
    });
}

const colorPropsSet = new Set([
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
]);

const knownNonPxConvertableValuesSet = new Set(['100%', 'auto', '100vh', '100vw']);

// TODO get this form tailwind config
const sizes = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 224, 256];

function roundSize(num) {
    // do nothing if not in range
    if (num < sizes[0] || num > sizes[sizes.length - 1]) {
        return num;
    }
    const dist = sizes.map((size) => Math.abs(size - num));
    const index = dist.indexOf(Math.min(...dist));
    return sizes[index];
}

async function classesRawJson(css) {
    const classNames = await extractSingleClassNames(css);
    // return slow_NormalizeClasses(css, classNames.slice(0, 10));
    return slow_NormalizeClasses(css, classNames);
}

function omitIf(obj, ...fns) {
    return Object.fromEntries(Object.entries(obj).filter((touple) => !fns.some((fn) => fn(touple))));
}

function isShorthand([prop, value]) {
    return value.includes(' ');
}

function isVariable([prop, value]) {
    return prop.startsWith('--');
}

function isSubset(parent, child) {
    const a = omitIf(parent, isShorthand, isVariable);
    const b = omitIf(child, isShorthand, isVariable);
    if (Object.keys(child).length === 0) {
        return false;
    }
    if (isEqual(a, b)) {
        return false;
    }
    return isMatch(a, b);
}

function touplesToCssDict(touples) {
    return touples.map(([prop, value]) => `${prop}: ${value}`).join(';');
}
async function parseSingleClasses(css) {
    const ast = await parse(css);
    const result = {};
    ast.walkRules((rule) => {
        if (rule.parent.type === 'root' && /^\.[a-z0-9-]+$/.test(rule.selector)) {
            const selector = rule.selector.slice(1);
            rule.walkDecls((decl) => {
                if (!result[selector]) {
                    result[selector] = [];
                }
                result[selector].push([decl.prop, decl.value]);
            });
        }
    });
    return result;
}

async function extractSingleClasses(css) {
    const singleClassesJson = await parseSingleClasses(css);

    return Object.fromEntries(
        Object.entries(singleClassesJson).map(([cx, touples]) => [cx, Object.fromEntries(touples)]),
    );
}

function resolveLocalVariables(touples) {
    const variables = touples.filter((touple) => {
        return touple[0].startsWith('--');
    });

    return touples.map(([prop, value]) => {
        const resolvedValue = variables.reduce((str, [varN, varV]) => str.split(`var(${varN})`).join(varV), value);
        return [prop, resolvedValue];
    });
}

function extendCssJsonWithNormalized(touples) {
    const declaration = new CSSStyleDeclaration();
    const resolvedTouples = resolveLocalVariables(touples)
    resolvedTouples.forEach(([prop, value]) => {
        declaration.setProperty(prop, value)
    })

    const normalized = normalizeTouplesByColor(normalizeTouplesBySize(Object.entries(declaration._values)));
    
    return Object.fromEntries(normalized);
}

async function normalizeSingleClasses(css) {
    const singleClassesJson = await parseSingleClasses(css);

    return Object.fromEntries(
        Object.entries(singleClassesJson)
            .map(([twClass, touples]) => {
                return [twClass, extendCssJsonWithNormalized(touples)];
            }),
    );
}

function filterTailwind(normalizedTailwind, normalizedCssMap) {
    const resultEntries = Object.entries(normalizedTailwind)
        .filter(([twClass, value], index) => {
            return isSubset(normalizedCssMap, value);
        })
        // remove redundants
        .filter(([twClass, value], index, arr) => {
            for (let i = 0; i < arr.length; i++) {
                if (i === index) {
                    continue;
                }
                if (isSubset(arr[i][1], value)) {
                    return false;
                }
            }
            return true;
        });

    const result = Object.fromEntries(resultEntries);

    const resultMap = Object.keys(
        resultEntries.reduce(
            (acc, [twClass, map]) => ({
                ...acc,
                ...map,
            }),
            {},
        ),
    );

    const meta = {
        missing: Object.keys(normalizedCssMap).filter((prop) => !resultMap.includes(prop)),
    };

    return {
        result,
        meta,
    };
}

(async () => {
    const alertCss = `.alert {
        position: relative;
        padding: 1.6rem 4.6rem;
        margin-bottom: 1.6rem;
        border: 1px solid #e5e5e5;
        color: #fff;
        border-radius: 0.2rem;
        width: 100%;
      } `;

    const { alert: alertJsonNormalized } = await normalizeSingleClasses(alertCss);

    // ///////////

    const css = await fs.readFile('./tailwind.css', 'utf8');

    // const tailwindRaw = await extractSingleClasses(css);
    // // const tailwindRaw = JSON.parse(await fs.readFile('./tailwind.raw.json', 'utf8'));
    // await fs.writeFile('./tailwind.raw.json', JSON.stringify(tailwindRaw, null, 2), 'utf8');

    const tailwindNormalized = await normalizeSingleClasses(css);
    // const tailwindNormalized = JSON.parse(await fs.readFile('./tailwind.normalized.json', 'utf8'));
    await fs.writeFile('./tailwind.normalized.json', JSON.stringify(tailwindNormalized, null, 2), 'utf8');

    // ////////

    const { result, meta } = filterTailwind(tailwindNormalized, alertJsonNormalized);

    console.log('alertJsonNormalized', alertJsonNormalized);
    console.log();
    console.log('====');
    console.log('Results:', result);
    console.log('Tailwind classes:', Object.keys(result));
    console.log('Missing:', meta.missing);

    /*
        # Problems

        - colors
        - borders

        ## TODO

        - default font size to convert rem to px
        - normalize colors https://www.npmjs.com/package/css-color-converter#torgbaarray
        - color distance
    */
})();