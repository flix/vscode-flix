const { build } = require("esbuild");
const sharedConfig = {
  entryPoints: ["client/src/extension.ts", "server/src/server.ts"],
  bundle: true,
  minify: true,
};
build({
  ...sharedConfig,
  platform: 'node', // for CJS
  outdir: "dist",
  external: ["vscode"],
});