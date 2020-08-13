import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
    input: 'node_modules/cssstyle/lib/CSSStyleDeclaration.js',
    output: {
        file: 'patched-lib/CSSStyleDeclaration.js',
        format: 'cjs',
    },
    plugins: [
        json(),
        resolve({
            // do not include "cssom" in the bundle to prevent circular dependencies
            resolveOnly: [/^(?!cssom$)/]
        }),
        commonjs(),
    ],
};
