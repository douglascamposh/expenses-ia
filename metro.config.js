// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // Enable CSS support.
  isCSSEnabled: true,
});

// Add .bin for whisper models (tiny ≈77MB)
config.resolver.assetExts.push('bin');
config.resolver.assetExts.push('mlmodelc');

module.exports = config;
