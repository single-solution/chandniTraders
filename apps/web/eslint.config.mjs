/**
 * ESLint flat config for the storefront.
 *
 * `eslint-config-next` 16 ships native flat config exports — no
 * `@eslint/eslintrc` `FlatCompat` shim required. The default export already
 * combines `next/core-web-vitals` + `next/typescript`, so we just spread it.
 */
import nextConfig from "eslint-config-next";

const webEslintConfig = [
	...nextConfig,
	{
		ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
	},
];

export default webEslintConfig;
