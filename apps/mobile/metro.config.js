const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const storeClient = fs.realpathSync(
  path.join(__dirname, 'node_modules/@skkil/store-client'),
);

config.watchFolders = [...(config.watchFolders ?? []), storeClient];

const native = path.join(__dirname, 'native');
const escape = (dir) => dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  ...['target', 'android/build', 'android/.cxx'].map(
    (dir) => new RegExp(`^${escape(path.join(native, dir))}(/.*)?$`),
  ),
];

module.exports = config;
