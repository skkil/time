const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const storeClient = fs.realpathSync(
  path.join(__dirname, 'node_modules/@skkil/store-client'),
);

config.watchFolders = [...(config.watchFolders ?? []), storeClient];

module.exports = config;
