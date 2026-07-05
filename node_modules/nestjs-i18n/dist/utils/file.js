"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFiles = exports.getDirectories = exports.isDirectory = exports.exists = void 0;
exports.mapAsync = mapAsync;
exports.filterAsync = filterAsync;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const exists = async (path) => {
    try {
        await (0, promises_1.access)(path);
        return true;
    }
    catch {
        return false;
    }
};
exports.exists = exists;
function mapAsync(array, callbackfn) {
    return Promise.all(array.map(callbackfn));
}
async function filterAsync(array, callbackfn) {
    const filterMap = await mapAsync(array, callbackfn);
    return array.filter((_, index) => filterMap[index]);
}
const isDirectory = async (source) => (await (0, promises_1.lstat)(source)).isDirectory();
exports.isDirectory = isDirectory;
const getDirectories = async (source) => {
    const dirs = await (0, promises_1.readdir)(source);
    return filterAsync(dirs.map((name) => path_1.default.join(source, name)), exports.isDirectory);
};
exports.getDirectories = getDirectories;
const getFiles = async (dirPath, pattern, includeSubfolders) => {
    const dirs = await (0, promises_1.readdir)(dirPath, {
        withFileTypes: true,
    });
    const files = [];
    const deepFiles = [];
    for (const f of dirs) {
        try {
            if (f.isFile() && pattern.test(f.name)) {
                files.push(f);
            }
            else if (includeSubfolders && f.isDirectory()) {
                deepFiles.push(...(await (0, exports.getFiles)(path_1.default.join(dirPath, f.name), pattern, includeSubfolders)));
            }
        }
        catch {
            continue;
        }
    }
    return files.map((f) => path_1.default.join(dirPath, f.name)).concat(deepFiles);
};
exports.getFiles = getFiles;
//# sourceMappingURL=file.js.map