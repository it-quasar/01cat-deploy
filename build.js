"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var fs_1 = require("fs");
var glob_1 = require("glob");
var path_1 = require("path");
var request = require("request");
var rimraf = require("rimraf");
var index_1 = require("./index");
/**
 * Собирает проект и возвращает путь к папке с собранным проектом
 */
function buildApp(options) {
    return __awaiter(this, void 0, void 0, function () {
        var siteName, build, wpBuildBuildOptions, wpBuildBuildCommand, distDir;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    siteName = options.siteName, build = options.build;
                    wpBuildBuildOptions = [
                        'build',
                    ];
                    if (build !== index_1.Build.Alpha) {
                        wpBuildBuildOptions.push('--prod');
                    }
                    if (build !== index_1.Build.Prod) {
                        wpBuildBuildOptions.push("--deploy-url=" + siteName);
                    }
                    wpBuildBuildCommand = "wpbuild " + wpBuildBuildOptions.join(' ');
                    process.stdout.write("Run wpbuild \"" + wpBuildBuildCommand + "\"...\n");
                    return [4 /*yield*/, (new Promise(function (resolve, reject) {
                            var rsync = child_process_1.spawn(path_1.join(process.cwd(), 'node_modules', '.bin', 'wpbuild'), wpBuildBuildOptions, {
                                shell: true,
                            });
                            rsync.stdout.on('data', function (data) {
                                process.stdout.write(data.toString());
                            });
                            rsync.stderr.on('data', function (data) {
                                process.stderr.write(data.toString());
                            });
                            rsync.on('exit', function (code) {
                                if (code !== 0) {
                                    reject("Wpbuild complete with code = " + code + "\n");
                                }
                                resolve();
                            });
                        }))];
                case 1:
                    _a.sent();
                    process.stdout.write("Wpbuild success...\n\n");
                    distDir = path_1.join(process.cwd(), 'dist');
                    // Скопируем файлы-шаблоны
                    return [4 /*yield*/, copyTemplateFiles(options, distDir)];
                case 2:
                    // Скопируем файлы-шаблоны
                    _a.sent();
                    // Удалим ненужные фалы и папки WP
                    process.stdout.write("Remove default wp-content...\n");
                    rimraf.sync(path_1.join(distDir, 'wordpress', 'wp-content'));
                    process.stdout.write("Remove default wp-content success...\n");
                    return [2 /*return*/, distDir];
            }
        });
    });
}
exports.buildApp = buildApp;
function getWPSalt() {
    return new Promise(function (resolve) {
        request('https://api.wordpress.org/secret-key/1.1/salt/', function (error, response, body) {
            if (!error && response.statusCode === 200) {
                resolve(body);
            }
        });
    });
}
function copyTemplateFiles(options, distDir) {
    return __awaiter(this, void 0, void 0, function () {
        var projectConfig, siteName, pullRequest, build, salt, templateGlobResult, templateFiles, _i, templateFiles_1, file, newFileName, newFileFullPath, newFileContent, newFileFullPath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectConfig = options.projectConfig, siteName = options.siteName, pullRequest = options.pullRequest, build = options.build;
                    return [4 /*yield*/, getWPSalt()];
                case 1:
                    salt = _a.sent();
                    templateGlobResult = glob_1.sync(path_1.join(__dirname, 'templates', '**/*'), { dot: true });
                    templateFiles = templateGlobResult.filter(function (file) {
                        var stat = fs_1.lstatSync(file);
                        return stat.isFile();
                    });
                    _i = 0, templateFiles_1 = templateFiles;
                    _a.label = 2;
                case 2:
                    if (!(_i < templateFiles_1.length)) return [3 /*break*/, 5];
                    file = templateFiles_1[_i];
                    newFileName = path_1.basename(file);
                    newFileFullPath = path_1.join(distDir, newFileName);
                    try {
                        fs_1.unlinkSync(newFileFullPath);
                    }
                    catch (e) {
                        // Ничего не делаем
                    }
                    return [4 /*yield*/, prepareTemplateFile(options, file, salt)];
                case 3:
                    newFileContent = _a.sent();
                    fs_1.writeFileSync(newFileFullPath, newFileContent);
                    process.stdout.write("Created file " + newFileFullPath + "\n");
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    // Для PR создадим ссылку на wp-content/uploads
                    if (pullRequest) {
                        newFileFullPath = path_1.join(distDir, 'wp-content', 'uploads');
                        try {
                            fs_1.unlinkSync(newFileFullPath);
                        }
                        catch (e) {
                            // Ничего не делаем
                        }
                        fs_1.symlinkSync('../../wp-content/uploads', newFileFullPath);
                        process.stdout.write("Created symlink " + newFileFullPath + "\n");
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function prepareTemplateFile(_a, file, salt) {
    var projectConfig = _a.projectConfig, build = _a.build, siteName = _a.siteName;
    return __awaiter(this, void 0, void 0, function () {
        var project, db, dbArray, dbUser, dbName, dbPassword, wpDebug, fileContent;
        return __generator(this, function (_b) {
            project = projectConfig.project;
            db = project.db[build === 'alpha' ? 'alpha' : 'prod'];
            dbArray = db.split(':');
            dbUser = dbArray[0];
            dbName = dbArray[0];
            dbPassword = dbArray[1];
            wpDebug = build === 'alpha' ? 'true' : 'false';
            fileContent = fs_1.readFileSync(file, 'utf-8');
            return [2 /*return*/, fileContent
                    .replace(/%SITE_NAME%/g, siteName)
                    .replace(/%DB_NAME%/g, dbName)
                    .replace(/%DB_USER%/g, dbUser)
                    .replace(/%DB_PASSWORD%/g, dbPassword)
                    .replace(/%UNIQUE_KEYS_AND_SALTS%/g, salt)
                    .replace(/%WP_DEBUG%/g, wpDebug)];
        });
    });
}
