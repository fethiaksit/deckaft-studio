const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// exFAT volumes create AppleDouble metadata beside files. They are not routes.
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /(^|[/\\])\._[^/\\]*$/,
];
module.exports = config;
