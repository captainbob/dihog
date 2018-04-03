import webpack from 'webpack';
import { join } from 'path';
import pullAll from 'lodash.pullall';
import uniq from 'lodash.uniq';

export default function (argv, rcConfig, paths) {
  const appBuild = paths.dllNodeModule;
  const pkg = require(join(paths.appDirectory, 'package.json')); // eslint-disable-line

  const { include, exclude } = rcConfig.dllPlugin || {};

  const dependencyNames = Object.keys(pkg.dependencies);
  const includeDependencies = uniq(dependencyNames.concat(include || []));

  const dependencies = pullAll(includeDependencies, exclude);

  const alias = dependencies.reduce((total, current) => {
    total[current] = join(paths.appNodeModules, current);
    return total;
  }, {});

  return {
    entry: {
      dihog: dependencies,
    },
    output: {
      path: appBuild,
      filename: '[name].dll.js',
      library: '[name]',
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('production'),
        },
      }),
      new webpack.optimize.UglifyJsPlugin({
        compress: {
          screw_ie8: true, // React doesn't support IE8
          warnings: false,
        },
        mangle: {
          screw_ie8: true,
        },
        output: {
          comments: false,
          screw_ie8: true,
          ascii_only: true,
        },
      }),
      new webpack.DllPlugin({
        path: join(appBuild, '[name]-manifest.json'),
        name: '[name]',
        context: paths.appSrc,
      }),
    ],
    resolve: { alias },
  };
}
