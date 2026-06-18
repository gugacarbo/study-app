/**
 * '*.ts': {
 *  title: 'Log staged TS files to console',
 *  task: async (files) => {
 *   console.log('Staged TS files:', files);
 *  },
 * },
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
	"*": "pnpm run biome:fix --no-errors-on-unmatched",
	"*.{md,mdx}": async (files) => {
		const escapedFiles = files.map((file) => `"${file}"`).join(" ");
		return `pnpm format:md --ignore-unknown ${escapedFiles}`;
	},
	"*.{ts,tsx}": async () => {
		return "node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/code-check/typecheck-staged.ts";
	},
};
