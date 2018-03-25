import chalk from 'chalk';
import cluster from 'cluster';
import fs from 'fs-extra';
import path from 'path';
import filesize from 'filesize';
import { sync as gzipSize } from 'gzip-size';
import webpack from 'webpack';
import recursive from 'recursive-readdir';
import stripAnsi from 'strip-ansi';
import getPaths from './config/paths';
import getConfig from './utils/getConfig';
import runArray from './utils/runArray';
import applyWebpackConfig, { warnIfExists } from './utils/applyWebpackConfig';
import copyDirSync from './utils/copy-dir';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const argv = require('yargs')
  .usage('Usage: dihog build [options]')
  .option('debug', {
    type: 'boolean',
    describe: 'Build without compress',
    default: false,
  })
  .option('watch', {
    type: 'boolean',
    alias: 'w',
    describe: 'Watch file changes and rebuild',
    default: false,
  })
  .option('output-path', {
    type: 'string',
    alias: 'o',
    describe: 'Specify output path',
    default: null,
  })
  .option('analyze', {
    type: 'boolean',
    describe: 'Visualize and analyze your Webpack bundle.',
    default: false,
  })
  .help('h')
  .argv;

let rcConfig;
let outputPath;
let appBuild;
let appStatic;
let config;

function getOutputPath(rcConfig) {
  if (Array.isArray(rcConfig)) {
    return rcConfig[0].outputPath;
  } else {
    return rcConfig.outputPath;
  }
}

// Print a detailed summary of build files.
function printFileSizes(stats) {
  const MAX_LIMIT_OUTPUT = 50;
  let assets = stats.toJson().assets;
  const fileCount = assets.length;
  assets = assets.filter((asset, index) => {
    return index < MAX_LIMIT_OUTPUT && /\.(js|css)$/.test(asset.name);
  }).map((asset) => {
    const fileContents = fs.readFileSync(`${appBuild}/${asset.name}`);
    const size = gzipSize(fileContents);
    return {
      folder: path.join(outputPath, path.dirname(asset.name)),
      name: path.basename(asset.name),
      size,
      sizeLabel: filesize(size),
    };
  });
  assets.sort((a, b) => b.size - a.size);
  const longestSizeLabelLength = Math.max.apply(
    null,
    assets.map(a => stripAnsi(a.sizeLabel).length),
  );
  assets.forEach((asset) => {
    let sizeLabel = asset.sizeLabel;
    const sizeLength = stripAnsi(sizeLabel).length;
    if (sizeLength < longestSizeLabelLength) {
      const rightPadding = ' '.repeat(longestSizeLabelLength - sizeLength);
      sizeLabel += rightPadding;
    }
    console.log(
      green(`  ${sizeLabel}  ${chalk.dim(asset.folder + path.sep)}${chalk.cyan(asset.name)}`),
    );
  });
  if (fileCount > MAX_LIMIT_OUTPUT) {
    console.log('\n  more output files...');
  }
}

function red(string) {
  return string;
}

function green(string) {
  return string;
}

// Print out errors
function printErrors(summary, errors) {
  console.log(chalk.red(summary));
  console.log();
  errors.forEach((err) => {
    console.log(chalk.red(red(err.message || err)));
    console.log();
  });
}

function doneHandler(argv, err, stats) {
  if (err) {
    printErrors('Failed to compile.', [err]);
    if (!argv.watch) {
      process.exit(1);
    }
    return;
  }

  runArray(stats.stats || stats, (item) => {
    if (item.compilation.errors.length) {
      printErrors('Failed to compile.', item.compilation.errors);
      if (!argv.watch) {
        process.exit(1);
      }
    }
  });

  warnIfExists();

  if (stats.stats) {
    console.log(chalk.green('Compiled successfully.'));
  } else {
    console.log(chalk.green(`Compiled successfully in ${(stats.toJson().time / 1000).toFixed(1)}s.`));
    console.log();

    if (!argv.debug) {
      console.log('File sizes after gzip:');
      console.log();
      printFileSizes(stats);
      console.log();
    }
  }

  if (argv.analyze) {
    console.log(`Analyze result is generated at ${chalk.cyan('dist/stats.html')}.`);
    console.log();
  }

  if (!argv.watch) {
    process.exit(0);
  }
}

// Create the production build and print the deployment instructions.
function realBuild(argv) {
  if (argv.debug) {
    console.log('Creating an development build without compress...');
  } else {
    if (argv.zip) {
      console.log('Creating an optimized production build with compress...');
    } else {
      console.log('Creating an optimized production build without compress...');
    }
  }

  const entry = config.entry;
  const done = doneHandler.bind(null, argv);

  const compiler = webpack(config);
  if (argv.watch) {
    compiler.watch(200, done);
  } else {
    compiler.run(done);
  }

  // if (Object.keys(entry).length <= 1 || argv.watch) {
  //   const compiler = webpack(config);
  //   if (argv.watch) {
  //     compiler.watch(200, done);
  //   } else {
  //     compiler.run(done);
  //   }
  // } else {
  //   const processNumbers = 2;
  //   const entries = {
  //     0: {},
  //     1: {}
  //   };
  //   Object.keys(entry).forEach((key, index) => {
  //     entries[index % processNumbers][key] = entry[key];
  //   });

  //   const config0 = Object.assign({}, config);
  //   config0.entry = entries[0];

  //   const config1 = Object.assign({}, config);
  //   config1.entry = entries[1];

  //   if (cluster.isMaster) {
  //     // Fork workers.
  //     for (var i = 0; i < processNumbers; i++) {
  //       cluster.fork({ processNumber: "" + i });
  //     }
  //     var i = processNumbers;
  //     var exitCode = 0;
  //     cluster.on('exit', function (worker, code, signal) {
  //       if (parseInt(code) != 0) {
  //         exitCode = parseInt(code);
  //       }
  //       if (!--i) {
  //         process.exit(exitCode);
  //       }
  //     });
  //   } else {
  //     let realConfig = null;
  //     if (process.env.processNumber == "0") {
  //       realConfig = config0;
  //     } else {
  //       realConfig = config1;
  //     }
  //     const compiler = webpack(realConfig);
  //     compiler.run(done);
  //   }
  // }
}

let isFileCopied = false;

export function build(argv) {
  const paths = getPaths(argv.cwd);

  try {
    rcConfig = getConfig(process.env.NODE_ENV, argv.cwd, argv.dir);
  } catch (e) {
    console.log(chalk.red('Failed to parse dihog.json config.'));
    console.log();
    console.log(e.message);
    process.exit(1);
  }

  outputPath = argv.outputPath || getOutputPath(rcConfig) || 'dist';
  appBuild = paths.resolveApp(outputPath);
  appStatic = paths.appStatic;

  config = runArray(rcConfig, (c) => {
    return applyWebpackConfig(
      require('./config/webpack.config.prod')(argv, appBuild, c, paths),
      process.env.NODE_ENV,
    );
  });

  return realBuild(argv);
}

// Run.
if (require.main === module) {
  build({ ...argv, cwd: process.cwd() });
}