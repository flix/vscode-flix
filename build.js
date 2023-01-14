const { build } = require("esbuild");
build({
    entryPoints: ["client/src/extension.ts"],
    bundle: true,
    minify: true,
    platform: 'node',
    outfile: "client/out/extension.js",
    external: ["vscode"],
});
build({
    entryPoints: ["server/src/server.ts"],
    bundle: true,
    minify: true,
    platform: 'node',
    outfile: "server/out/server.js",
    external: ["vscode"],
  });