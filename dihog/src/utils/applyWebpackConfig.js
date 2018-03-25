import { existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

require('./registerBabel');

export function warnIfExists() {
  const filePath = resolve('webpack.config.js');
  if (existsSync(filePath)) {
    console.log(chalk.yellow(`⚠️ ⚠️ ⚠️  It\\'s not recommended to use ${chalk.bold('webpack.config.js')}, since dihog\\'s major or minor version upgrades may result in incompatibility. If you insist on doing so, please be careful of the compatibility after upgrading dihog.`));
    console.log();
  }
}

export default function applyWebpackConfig(config, env) {
  const filePath = resolve('webpack.config.js');
  if (existsSync(filePath)) {
    return require(filePath)(config, env);  // eslint-disable-line
  } else {
    return config;
  }
}
