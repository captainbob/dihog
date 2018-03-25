import { join } from 'path';
import winPath from './winPath';
import { DIHOG_CONFIG_JSON_FILE, DIHOG_MOCK_FILE } from '../config/globalConfig';
const cwd = process.cwd();
const files = [
  'webpack.config.js',
  `${DIHOG_CONFIG_JSON_FILE}.js`,
  `${DIHOG_MOCK_FILE}.js`,
  winPath(join(cwd, 'mock')),
  winPath(join(cwd, 'src')),
];

if (process.env.NODE_ENV !== 'test') {
  require('babel-register')({
    only: new RegExp(`(${files.join('|')})`),
    presets: [
      require.resolve('babel-preset-es2015'),
      require.resolve('babel-preset-react'),
      require.resolve('babel-preset-stage-0'),
    ],
    plugins: [
      require.resolve('babel-plugin-add-module-exports'),
    ],
    babelrc: false,
  });
}
