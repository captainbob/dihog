import { existsSync, readFileSync } from 'fs';
import stripJsonComments from 'strip-json-comments';
import isPlainObject from 'is-plain-object';
import parseJSON from 'parse-json-pretty';
import getPaths from '../config/paths';
import { DIHOG_CONFIG_JSON_FILE, DIHOG_MOCK_FILE } from '../config/globalConfig';
require('./registerBabel');

function merge(oldObj, newObj) {
  for (const key in newObj) {
    if (Array.isArray(newObj[key]) && Array.isArray(oldObj[key])) {
      oldObj[key] = oldObj[key].concat(newObj[key]);
    } else if (isPlainObject(newObj[key]) && isPlainObject(oldObj[key])) {
      oldObj[key] = Object.assign(oldObj[key], newObj[key]);
    } else {
      oldObj[key] = newObj[key];
    }
  }
}

function getConfig(configFile, paths) {
  const rcConfig = paths.resolveApp(configFile);
  const jsConfig = paths.resolveApp(`${configFile}.js`);

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

function replaceNpmVariables(value, pkg) {
  if (typeof value === 'string') {
    return value
      .replace('$npm_package_name', pkg.name)
      .replace('$npm_package_version', pkg.version);
  } else {
    return value;
  }
}

function mergeConfig(config, env, pkg) {
  if (config.env) {
    if (config.env[env]) merge(config, config.env[env]);
    delete config.env;
  }
  return Object.keys(config).reduce((memo, key) => {
    memo[key] = replaceNpmVariables(config[key], pkg);
    return memo;
  }, {});
}

function replaceDir(config, dir) {
  if (dir === true) {
    dir = '';
  }
  dir = dir || '';
  let entry = Array.from(config.entry);
  if (typeof entry === 'string') {
    entry = [entry];
  }

  entry = entry.map(function (item) {
    return item.replace('${dir}', dir);
  });

  return Object.assign({}, config, { entry });
}

export function realGetConfig(configFile, env, pkg = {}, paths, dir) {
  env = env || 'development';
  const config = replaceDir(getConfig(configFile, paths), dir);
  if (Array.isArray(config)) {
    return config.map((c) => {
      return mergeConfig(c, env, pkg);
    });
  } else {
    return mergeConfig(config, env, pkg);
  }
}

export default function (env, cwd, dir) {
  const paths = getPaths(cwd);
  const pkg = JSON.parse(readFileSync(paths.appPackageJson, 'utf-8'));
  return realGetConfig(DIHOG_CONFIG_JSON_FILE, env, pkg, paths, dir);
}