import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'node_modules/cssstyle/lib/CSSStyleDeclaration.js',
    output: {
        file: 'patched-lib/CSSStyleDeclaration.js',
        format: 'cjs',
    },
    plugins: [
        resolve({
            resolveOnly: [/^(?!cssom$)/]
        }),
        commonjs({
            // include: ['node_modules/cssom/lib/parse.js'],
            // exclude: ['node_modules/cssom/lib/CSSStyleDeclaration.js'],
        }),
    ],
};
