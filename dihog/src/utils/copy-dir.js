import fs from 'fs-extra';
import path from 'path';

function copyDirSync(src, dest) {
    fs.ensureDirSync(dest);
    var files = fs.readdirSync(src);
    for (var i = 0; i < files.length; i++) {
        var current = fs.lstatSync(path.join(src, files[i]));
        if (current.isDirectory()) {
            copyDirSync(path.join(src, files[i]), path.join(dest, files[i]));
        } else if (current.isSymbolicLink()) {
            var symlink = fs.readlinkSync(path.join(src, files[i]));
            fs.symlinkSync(symlink, path.join(dest, files[i]));
        } else {
            fs.copySync(path.join(src, files[i]), path.join(dest, files[i]));
        }
    }
};

export default copyDirSync;