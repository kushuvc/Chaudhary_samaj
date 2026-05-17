const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, '../../packages');

const config = getDefaultConfig(projectRoot);

// Bind to all interfaces for LAN access
config.server = {
  ...config.server,
  host: '0.0.0.0',
  port: 8081,
};

config.watchFolders = [...config.watchFolders, packagesRoot];
config.resolver.extraNodeModules = {
	react: path.resolve(projectRoot, 'node_modules/react'),
	'react-native': path.resolve(projectRoot, 'node_modules/react-native')
};

// Fix: Disable Hermes transform for web compatibility
config.transformer = {
  ...config.transformer,
  hermesParser: false,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

module.exports = config;