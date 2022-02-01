const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

const pkg = require('./package.json');

module.exports = [
    // ESM
    {
        input: 'index.ts',
        treeshake: false,
        external: ['lodash', '@paychex/core'],
        plugins: [
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            }),
            typescript({
                tsconfig: './tsconfig.json',
            })
        ],
        output: {
            file: pkg.module,
            format: "esm",
            exports: "named",
            sourcemap: true,
            banner: `/*! ${pkg.name} v${pkg.version} */`,
        },
    },
    // CJS
    {
        input: 'index.ts',
        treeshake: false,
        external: ['lodash', '@paychex/core'],
        plugins: [
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            }),
            typescript({
                tsconfig: './tsconfig.json',
            })
        ],
        output: {
            file: pkg.main,
            format: "cjs",
            exports: "named",
            sourcemap: true,
            banner: `/*! ${pkg.name} v${pkg.version} */`,
        },
    },
];