import webpack from 'webpack';
import autoprefixer from 'autoprefixer';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import normalizeDefine from '../utils/normalizeDefine';
import winPath from '../utils/winPath';
import getPaths from './paths';

const myPaths = getPaths(process.cwd());

export function getBabelOptions(config) {
  return {
    babelrc: false,
    presets: [
      require.resolve('babel-preset-es2015'),
      require.resolve('babel-preset-react'),
      require.resolve('babel-preset-stage-0'),
    ].concat(config.extraBabelPresets || []),
    plugins: [
      require.resolve('babel-plugin-add-module-exports'),
      require.resolve('babel-plugin-react-require'),
      require.resolve('babel-plugin-syntax-dynamic-import'),
    ].concat(config.extraBabelPlugins || []),
    cacheDirectory: true,
  };
}

export const baseSvgLoader = {
  test: /\.svg$/,
  loader: 'file',
  options: {
    name: 'static/[name].[hash:8].[ext]',
  },
};

export const spriteSvgLoader = {
  test: /\.(svg)$/i,
  loader: 'svg-sprite',
};

export const defaultDevtool = '#cheap-module-eval-source-map';

function getAliasPath(alias = {}) {
  const newAlias = {};
  for (const item in alias) {
    if (Object.prototype.hasOwnProperty.call(alias, item)) {
      newAlias[item] = myPaths.resolveApp(alias[item]);
    }
  }
  return newAlias;
}

export function getResolve(config, paths) {
  return {
    resolve: {
      modules: [
        paths.ownNodeModules,
        paths.appNodeModules,
        'node_modules',
      ],
      extensions: [
        ...(config.extraResolveExtensions || []),
        '.web.js', '.web.jsx', '.web.ts', '.web.tsx',
        '.js', '.json', '.jsx', '.ts', '.tsx',
      ],
      alias: getAliasPath(config.resolveAlias),
    },
    resolveLoader: {
      modules: [
        paths.ownNodeModules,
        paths.appNodeModules,
      ],
      moduleExtensions: ['-loader'],
    },
  };
}

export function getFirstRules({ paths, babelOptions }) {
  return [
    {
      exclude: [
        /\.(html|ejs)$/,
        /\.(js|jsx)$/,
        /\.(css|less|scss)$/,
        /\.json$/,
        /\.svg$/,
        /\.tsx?$/,
      ],
      loader: 'url',
      options: {
        limit: 10000,
        name: 'static/[name].[hash:8].[ext]',
      },
    },
    {
      test: /\.(js|jsx)$/,
      include: paths.appSrc,
      loader: 'babel',
      options: babelOptions,
    },
  ];
}

export function getLastRules({ paths, babelOptions }) {
  return [
    {
      test: /\.html$/,
      loader: 'file',
      options: {
        name: '[name].[ext]',
      },
    },
    {
      test: /\.tsx?$/,
      include: paths.appSrc,
      use: [
        {
          loader: 'babel',
          options: babelOptions,
        },
        {
          loader: 'awesome-typescript',
          options: {
            transpileOnly: true,
          },
        },
      ],
    },
  ];
}

export function getCSSRules(env, { config, paths, cssLoaders, theme }) {
  function isExclude(modulePath) {
    if (config.cssModulesExclude && config.cssModulesExclude.length) {
      return config.cssModulesExclude.some((item) => {
        return winPath(join(paths.appDirectory, item)).indexOf(winPath(modulePath)) > -1;
      });
    }
    return false;
  }

  function includeTest(root, modulePath) {
    return modulePath.indexOf(root) > -1 && !isExclude(modulePath);
  }
  let rules = [
    {
      test: /\.css$/,
      include: includeTest.bind(null, paths.appSrc),
      use: [
        'style',
        ...cssLoaders.own,
      ],
    },
    {
      test: /\.less$/,
      include: includeTest.bind(null, paths.appSrc),
      use: [
        'style',
        ...cssLoaders.own,
        {
          loader: 'less',
          options: {
            modifyVars: theme,
          },
        },
      ],
    },
    {
      test: /\.css$/,
      include: includeTest.bind(null, paths.appNodeModules),
      use: [
        'style',
        ...cssLoaders.nodeModules,
      ],
    },
    {
      test: /\.less$/,
      include: includeTest.bind(null, paths.appNodeModules),
      use: [
        'style',
        ...cssLoaders.nodeModules,
        {
          loader: 'less',
          options: {
            modifyVars: theme,
          },
        },
      ],
    },
  ];
  if (config.cssModulesExclude && config.cssModulesExclude.length) {
    const include = config.cssModulesExclude.map((item) => {
      return join(paths.appDirectory, item);
    });
    rules = [
      ...rules,
      {
        test: /\.css$/,
        include,
        use: [
          'style',
          ...cssLoaders.noCSSModules,
        ],
      },
      {
        test: /\.less$/,
        include,
        use: [
          'style',
          ...cssLoaders.noCSSModules,
          {
            loader: 'less',
            options: {
              modifyVars: theme,
            },
          },
        ],
      },
    ];
  }
  if (config.sass) {
    const sassOptions = config.sass === true ? {} : config.sass;
    rules = [
      ...rules,
      {
        test: /\.scss$/,
        include: includeTest.bind(null, paths.appSrc),
        use: [
          'style',
          ...cssLoaders.own,
          {
            loader: 'sass',
            options: sassOptions,
          },
        ],
      },
      {
        test: /\.scss$/,
        include: includeTest.bind(null, paths.appNodeModules),
        use: [
          'style',
          ...cssLoaders.nodeModules,
          {
            loader: 'sass',
            options: sassOptions,
          },
        ],
      },
    ];

    if (config.cssModulesExclude && config.cssModulesExclude.length) {
      const include = config.cssModulesExclude.map((item) => {
        return join(paths.appDirectory, item);
      });
      rules = [
        ...rules,
        {
          test: /\.scss$/,
          include,
          use: [
            'style',
            ...cssLoaders.noCSSModules,
            {
              loader: 'sass',
              options: sassOptions,
            },
          ],
        },
      ];
    }
  }
  if (env === 'production') {
    rules.forEach((rule) => {
      rule.use = ExtractTextPlugin.extract({
        // fallback: 'style',
        use: rule.use.slice(1),
      });
    });
  }
  return rules;
}

export const node = {
  fs: 'empty',
  net: 'empty',
  tls: 'empty',
};

function getMultiPageHtml({ entry, packageVersion, NODE_ENV }) {
  const htmlPluginList = [];
  for (const key in entry) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      const beforePath = dirname(key);
      htmlPluginList.push(new HtmlWebpackPlugin({
        filename: `${beforePath}/index.html`,
        template: `${beforePath}/index.ejs`,
        chunks: [`${beforePath}/index`],
        inject: false,
        packageVersion,
        nodeEnv: NODE_ENV,
      }));
    }
  }
  return htmlPluginList;
}

export function getCommonPlugins({ config, paths, appBuild, NODE_ENV }) {
  let ret = [];

  let defineObj = {
    'process.env': {
      NODE_ENV: JSON.stringify(NODE_ENV),
    },
  };
  if (config.define) {
    defineObj = {
      ...defineObj,
      ...normalizeDefine(config.define),
    };
  }
  ret.push(new webpack.DefinePlugin(defineObj));
  // 如果没有多页面html标识时，去通用html入口
  if (config.multipagehtml) {
    ret = ret.concat(getMultiPageHtml({
      entry: config.entry,
      packageVersion: config.packageVersion,
      NODE_ENV,
    }));
  } else if (existsSync(join(paths.appSrc, 'index.ejs'))) {
    ret.push(new HtmlWebpackPlugin({
      template: 'src/index.ejs',
      inject: true,
      packageVersion: config.packageVersion,
      nodeEnv: JSON.stringify(NODE_ENV),
    }));
  }

  if (existsSync(paths.appPublic)) {
    ret.push(new CopyWebpackPlugin([
      {
        from: paths.appPublic,
        to: appBuild,
      },
    ]));
  }

  if (config.multipage) {
    // Support hash
    const name = config.hash ? 'common.[hash]' : 'common';
    ret.push(new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
      filename: `${name}.js`,
    }));
  }

  ret.push(new webpack.LoaderOptionsPlugin({
    options: {
      context: __dirname,
      postcss: [
        autoprefixer(config.autoprefixer || {
          browsers: [
            '>1%',
            'last 4 versions',
            'Firefox ESR',
            'not ie < 9', // React doesn't support IE8 anyway
          ],
        }),
        ...(config.extraPostCSSPlugins ? config.extraPostCSSPlugins : []),
      ],
    },
  }));

  return ret;
}

