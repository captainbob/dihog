import { existsSync, readFileSync, realpathSync } from 'fs';
import stripJsonComments from 'strip-json-comments';
import parseJSON from 'parse-json-pretty';
import { resolve } from 'path';
import { DIHOG_CONFIG_JSON_FILE } from './globalConfig';

// const { resolve } = require('path');

function resolveOwn(relativePath) {
  return resolve(__dirname, relativePath);
}

function _resolveApp(appDirectory, relativePath) {
  return resolve(appDirectory, relativePath);
}

function getConfig(appDirectory, configFile) {
  const rcConfig = _resolveApp(appDirectory, configFile);
  const jsConfig = _resolveApp(appDirectory, `${configFile}.js`);

  if (existsSync(rcConfig)) {
    if (process.env.NODE_ENV === 'development' && existsSync(jsConfig)) {
      console.error(`Config error: You must delete ${rcConfig} if you want to use ${jsConfig}`);
    }
    return parseJSON(stripJsonComments(readFileSync(rcConfig, 'utf-8')), configFile);
  } else if (existsSync(jsConfig)) {
    return require(jsConfig);  // eslint-disable-line
  } else {
    return {};
  }
}

function getOutputPath(rcConfig) {
  if (Array.isArray(rcConfig)) {
    return rcConfig[0].outputPath;
  } else {
    return rcConfig.outputPath;
  }
}

export default function getPaths(cwd) {
  const appDirectory = realpathSync(cwd);
  const rcConfig = getConfig(appDirectory, DIHOG_CONFIG_JSON_FILE);
  const appNodeModules = rcConfig.appNodeModules || 'node_modules';
  const appPackageJson = rcConfig.appPackageJson || 'package.json';
  const appSrc = rcConfig.appSrc || 'src';
  const appPublic = rcConfig.appPublic || 'public';
  const appBuild = getOutputPath(rcConfig) || 'dist';

  const dllNodeModule = `${appPublic || appNodeModules}/dihog-dlls`;
  const dllManifest = `${appPublic || appNodeModules}/dihog-dlls/dihog-manifest.json`;

  function resolveApp(relativePath) {
    return _resolveApp(appDirectory, relativePath);
  }

  return {
    appBuild: resolveApp(appBuild),
    appPublic: resolveApp(appPublic),
    appPackageJson: resolveApp(appPackageJson),
    appSrc: resolveApp(appSrc),
    appNodeModules: resolveApp(appNodeModules),
    ownNodeModules: resolveOwn('../../node_modules'),
    dllNodeModule: resolveApp(dllNodeModule),
    dllManifest: resolveApp(dllManifest),
    appBabelCache: resolveApp(`${appNodeModules}/.cache/babel-loader`),
    resolveApp,
    appDirectory,
  };
}
