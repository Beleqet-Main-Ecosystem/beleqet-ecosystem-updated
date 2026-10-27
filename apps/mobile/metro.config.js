const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch monorepo shared packages
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages/common'),
];

// 2. Explicitly map @beleqet/common and node modules for reliable monorepo resolution
config.resolver.extraNodeModules = {
  '@beleqet/common': path.resolve(monorepoRoot, 'packages/common'),
};

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
