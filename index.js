const parse = require('postcss-safe-parser');
const fs = require('fs').promises;
const { CSSStyleDeclaration } = require('cssstyle');
const allProperties = require('cssstyle/lib/allProperties');
const isMatchWith = require('lodash.ismatchwith');
const isEqual = require('lodash.isequal');
const parseSize = require('to-px');
const parseColor = require('css-color-converter');
const euclideanDistance = require('euclidean-distance');
const chalk = require('chalk');

const CONFIG = {
    COLOR_DELTA: 5,
};

function toNormalSize(v, rounder) {
    // patch the npm package, bc it returns null for '0'
    const px = v === '0' ? 0 : parseSize(v);

    if (typeof px === 'number') {
        return `${rounder(px)}px`;
    }

    return v;
}

function normalizeToupleBySize([prop, value]) {
    if (sizePropsSet.has(prop)) {
        return [prop, toNormalSize(value, roundCommonSize)];
    }

    return [prop, value];
}

function normalizeTouplesForBorderRadius(touples) {
    return touples.map(([prop, value]) => {
        if (prop === 'border-radius') {
            return [prop, toNormalSize(value, roundBorderRadius)];
        }
        return [prop, value];
    });
}

function normalizeTouplesForBorder(touples) {
    return touples.map(([prop, value]) => {
        if (borderSizePropsSet.has(prop)) {
            return [prop, toNormalSize(value, roundBorder)];
        }
        return [prop, value];
    });
}

function normalizeTouplesBySize(touples) {
    return touples.map(normalizeToupleBySize);
}

// TODO there are few other exotic sizes, like text-line-through-width
const sizePropsSet = new Set([
    'width',
    'max-width',
    'min-width',

    'height',
    'max-height',
    'min-height',

    'padding',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',

    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
]);

const borderSizePropsSet = new Set([
    'border-width',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
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

const colorPropsSet = new Set(Array.from(allProperties).filter((prop) => prop.includes('color')));

// TODO get this form tailwind config
const sizes = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 224, 256];

function roundCommonSize(num) {
    // do nothing if not in range
    if (num < sizes[0] || num > sizes[sizes.length - 1]) {
        return num;
    }
    const dist = sizes.map((size) => Math.abs(size - num));
    const index = dist.indexOf(Math.min(...dist));
    return sizes[index];
}

const bordeSizes = [0, 1, 2, 4, 8];

function roundBorder(num) {
    // do nothing if not in range
    if (num < bordeSizes[0] || num > bordeSizes[bordeSizes.length - 1]) {
        return num;
    }
    const dist = bordeSizes.map((size) => Math.abs(size - num));
    const index = dist.indexOf(Math.min(...dist));
    return bordeSizes[index];
}

const borderRadiusSizes = [0, 2, 4, 6, 8];

function roundBorderRadius(num) {
    // this must be a full round value
    if (num > 100) {
        return 9999;
    }
    // do nothing if not in range
    if (num < borderRadiusSizes[0] || num > borderRadiusSizes[borderRadiusSizes.length - 1]) {
        return num;
    }
    const dist = borderRadiusSizes.map((size) => Math.abs(size - num));
    const index = dist.indexOf(Math.min(...dist));
    return borderRadiusSizes[index];
}

async function classesRawJson(css) {
    const classNames = await extractSingleClassNames(css);
    // return slow_NormalizeClasses(css, classNames.slice(0, 10));
    return slow_NormalizeClasses(css, classNames);
}

function omitIf(obj, ...fns) {
    return Object.fromEntries(Object.entries(obj).filter((touple) => !fns.some((fn) => fn(touple))));
}

function isVariable([prop, value]) {
    return prop.startsWith('--');
}

function isSubset(parent, child, strict) {
    const a = omitIf(parent, isVariable);
    const b = omitIf(child, isVariable);
    if (Object.keys(a).length === 0 || Object.keys(b).length === 0) {
        return false;
    }
    if (isEqual(a, b)) {
        return false;
    }
    return isMatchWith(a, b, (va, vb, key, aaa, bbb) => {
        if (strict) {
            return undefined;
        }

        if (colorPropsSet.has(key)) {
            const x = parseColor(va).toRgbaArray();
            const y = parseColor(vb).toRgbaArray();
            const distance = euclideanDistance(x, y);
            return distance < CONFIG.COLOR_DELTA;
        }

        return undefined;
    });
}

function touplesToCssDict(touples) {
    return touples.map(([prop, value]) => `${prop}: ${value}`).join(';');
}

async function parseSingleClasses(css) {
    const ast = await parse(css);
    const result = {};
    ast.walkRules((rule) => {
        if (rule.parent.type === 'root' && /^\.[a-zA-Z0-9_:\/-]+$/.test(rule.selector)) {
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

function normalize(value) {
    return Object.fromEntries(
        normalizeTouplesByColor(
            normalizeTouplesForBorder(normalizeTouplesForBorderRadius(normalizeTouplesBySize(Object.entries(value)))),
        ),
    );
}

function extendCssJsonWithNormalized(touples) {
    const declaration = new CSSStyleDeclaration();
    const resolvedTouples = resolveLocalVariables(touples);
    resolvedTouples.forEach(([prop, value]) => {
        declaration.setProperty(prop, value);
    });

    return normalize(declaration.getNonShorthandValues());
}

async function normalizeSingleClasses(css) {
    const singleClassesJson = await parseSingleClasses(css);

    return Object.fromEntries(
        Object.entries(singleClassesJson).map(([twClass, touples]) => {
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
                if (isSubset(arr[i][1], value, true)) {
                    return false;
                }
            }
            return true;
        });

    const resultSheet = Object.fromEntries(resultEntries);
    const result = Object.keys(resultSheet).sort().join(' ');

    const resultMap = Object.keys(
        resultEntries.reduce(
            (acc, [twClass, map]) => ({
                ...acc,
                ...map,
            }),
            {},
        ),
    );

    const missing = Object.entries(normalizedCssMap)
        .filter(([prop]) => !resultMap.includes(prop))
        .reduce((str, [prop, value]) => `${str}\t${prop}: ${value}\n`, '');

    let error = null;
    let emoji = '✅';

    if (missing.length) {
        emoji = '⚠️ ';
    }

    if (result.length === 0 && missing.length === 0) {
        emoji = '❌';
        error = 'This class only contained unsupported CSS.';
    }

    return {
        result,
        resultSheet,
        missing,
        emoji,
        error,
    };
}

(async () => {
    const inputCss = `.alert {
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

    const input = await normalizeSingleClasses(inputCss);

    // ///////////

    const css = await fs.readFile('./tailwind.css', 'utf8');

    // const tailwindRaw = await extractSingleClasses(css);
    // // const tailwindRaw = JSON.parse(await fs.readFile('./tailwind.raw.json', 'utf8'));
    // await fs.writeFile('./tailwind.raw.json', JSON.stringify(tailwindRaw, null, 2), 'utf8');

    const tailwindNormalized = await normalizeSingleClasses(css);
    // const tailwindNormalized = JSON.parse(await fs.readFile('./tailwind.normalized.json', 'utf8'));
    await fs.writeFile('./tailwind.normalized.json', JSON.stringify(tailwindNormalized, null, 2), 'utf8');

    // ////////

    Object.entries(input).forEach(([cn, ii]) => {
        const { result, missing, resultSheet, emoji, error } = filterTailwind(tailwindNormalized, ii);

        console.log(emoji, `.${chalk.bold(cn)} --> [`, chalk.italic(result), ']');
        console.log(resultSheet);
        if (error) {
            console.log(error);
        }
        if (missing.length) {
            console.log('ℹ️  Missing CSS:\n', chalk.green(missing));
        }
        console.log();
    });

    /*

    TODO

        - CONFIG font size to convert rem to px
    */
})();
