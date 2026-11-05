// Keep the JSON a static dependency for Next.js and load it on Node without
// import attributes. Webpack rewrites new URL(relativePath, import.meta.url)
// to an asset URL that node:fs cannot read.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- This CommonJS bridge intentionally uses a static JSON require.
module.exports = require("../config/catalog-classification-evidence.json");
