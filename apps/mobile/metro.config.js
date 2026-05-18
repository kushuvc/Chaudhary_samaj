const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, '../../packages');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), packagesRoot];
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;