const { test, expect, devices, defineConfig: originalDefineConfig } = require('@playwright/experimental-ct-core');
const path = require('path');

const defineConfig = (config, ...configs) => {
  const c = originalDefineConfig({
    ...config,
    '@playwright/test': {
      packageJSON: require.resolve('./package.json'),
    },
    '@playwright/experimental-ct-core': {
      registerSourceFile: path.join(__dirname, 'registerSource.mjs'),
      frameworkPluginFactory: () => {
        console.log('frameworkPluginFactory');
        return import('vite-plugin-twigjs-loader').then(plugin => plugin.default())
      },
    },
  }, ...configs);

  c['@playwright/test'].babelPlugins = [[require.resolve('./transform')]];

  return c;
};

module.exports = { test, expect, devices, defineConfig };