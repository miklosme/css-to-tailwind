const { existsSync, promises: fs } = require('fs');
const path = require('path');
const postcss = require('postcss');
const resolveConfig = require('tailwindcss/resolveConfig');
const postCssTailwind = require('tailwindcss');
const postCssAutoprefixer = require('autoprefixer');

const dir = process.argv[2];
const configPath = path.resolve(String(dir), 'tailwind.config.js');

if (!existsSync(configPath)) {
    throw new Error('tailwind.config.js does not exist in given directory');
}

(async () => {
    const input = '@tailwind base; @tailwind components; @tailwind utilities;';

    const tailwindResolvedJson = resolveConfig(require(configPath));

    await fs.writeFile(
        path.resolve(dir, 'tailwind.resolved.json'),
        JSON.stringify(tailwindResolvedJson, null, 2),
        'utf8',
    );

    const { css: tailwindCss } = await postcss([postCssTailwind(configPath), postCssAutoprefixer]).process(input, {
        from: 'tailwind.css',
    });

    await fs.writeFile(path.resolve(dir, 'tailwind.css'), tailwindCss, 'utf8');

    // TODO generate normalized tailwind json
})();
