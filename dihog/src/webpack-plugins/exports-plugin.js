import glob from 'glob';
import path from 'path';
import fs from 'fs';
import stripJsonComments from 'strip-json-comments';

function mkdir(dirpath, dirname) {
    //判断是否是第一次调用  
    if (typeof dirname === "undefined") {
        if (fs.existsSync(dirpath)) {
            return;
        } else {
            mkdir(dirpath, path.dirname(dirpath));
        }
    } else {
        //判断第二个参数是否正常，避免调用时传入错误参数  
        if (dirname !== path.dirname(dirpath)) {
            mkdir(dirpath);
            return;
        }
        if (fs.existsSync(dirname)) {
            fs.mkdirSync(dirpath);
        } else {
            mkdir(dirname, path.dirname(dirname));
            fs.mkdirSync(dirpath);
        }
    }
}

function ExportsPlugin({ appSrc, appNodeModules }) {
    this.appSrc = appSrc;
    this.appNodeModules = appNodeModules;
}

function outputLibs(appSrc, appNodeModules, files) {
    var nodeModulesDir = appNodeModules;
    var filePath = '', fileContent = '', outputDir = '', outputPath = '', exportsJson, originalFileContent, moduleNames = [];
    for (var i = 0; i < files.length; i++) {
        //windows bugs
        filePath = path.join(path.resolve(appSrc), files[i]).replace(/\\/g, '\\\\');
        exportsJson = JSON.parse(stripJsonComments(fs.readFileSync(filePath, 'utf-8')));
        if (!exportsJson.entry) {
            throw new Error(`${filePath} entry cant be empty!!!`);
        }
        if (!exportsJson.name) {
            throw new Error(`${filePath} name cant be empty!!!`);
        }

        moduleNames.forEach(m => {
            if (m.name == exportsJson.name) {
                throw new Error(`
                  ${m.filePath}\n
                  ${filePath}\n
                  dumplicate module name ${exportsJson.name}`)
            }
        });

        moduleNames.push({
            name: exportsJson.name,
            filePath: filePath
        });

        filePath = path.join(path.dirname(filePath), exportsJson.entry);
        //windows bugs
        filePath = filePath.replace(/\\/g, '\\\\');
        fileContent = 'var djexports = ' + 'require("' + filePath + '")\n';
        fileContent += 'module.exports = djexports;';
        outputDir = path.join(nodeModulesDir, exportsJson.name);
        mkdir(outputDir);
        outputPath = path.join(outputDir, 'index.js');
        originalFileContent = '';
        if (fs.existsSync(outputPath)) {
            originalFileContent = fs.readFileSync(outputPath, 'utf-8');
        }
        if (originalFileContent != fileContent) {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            fs.writeFileSync(outputPath, fileContent, { encoding: 'utf-8' });
        }
    }
}

ExportsPlugin.prototype.apply = function (compiler) {
    var appSrc = this.appSrc
    var appNodeModules = this.appNodeModules;
    compiler.plugin("compile", function (params) {
        const files = glob.sync('**/exports.json', {
            cwd: appSrc,
        });
        outputLibs(appSrc, appNodeModules, files);
    });
}

module.exports = ExportsPlugin
