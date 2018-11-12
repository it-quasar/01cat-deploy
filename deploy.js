"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
var chalk_1 = require("chalk");
var child_process_1 = require("child_process");
var moment = require("moment");
var path_1 = require("path");
var ssh2_1 = require("ssh2");
var index_1 = require("./index");
function connect(options) {
    return new Promise(function (resolve, reject) {
        var conn = new ssh2_1.Client();
        conn.on('ready', function () {
            resolve(conn);
        }).connect({
            host: options.host,
            password: options.password,
            username: options.userName,
        });
    });
}
function exec(client, command) {
    return new Promise(function (resolve, reject) {
        process.stdout.write(chalk_1.default(templateObject_1 || (templateObject_1 = __makeTemplateObject(["{cyan SSH exec:} ", "\n"], ["{cyan SSH exec:} ", "\\n"])), command));
        client.exec(command, function (err, stream) {
            if (err) {
                reject(err);
            }
            stream
                .on('close', function (code) {
                if (code !== 0) {
                    reject(new Error("SSH command exit witch code " + code));
                }
                resolve();
            })
                .on('data', function (data) {
                process.stdout.write(data);
            }).stderr.on('data', function (data) {
                process.stderr.write(data);
            });
        });
    });
}
function deployApp(_a) {
    var projectConfig = _a.projectConfig, siteName = _a.siteName, distDir = _a.distDir, pullRequest = _a.pullRequest, build = _a.build;
    return __awaiter(this, void 0, void 0, function () {
        var project, prod, ftp, ftpUser, ftpPassword, ftpHost, remoteFolder, backupFolder, conn, backup, keepClean, rsh, excluded, exclude, rsyncArgs, rsyncCommand;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    project = projectConfig.project;
                    prod = { ftp: '', host: '' };
                    if (build === index_1.Build.Prod) {
                        if (!project.prod) {
                            throw new Error('Production config not found for ptoject');
                        }
                        else {
                            prod = project.prod;
                        }
                    }
                    ftp = build === index_1.Build.Prod ? prod.ftp : projectConfig.ftp[build];
                    ftpUser = ftp.split(':')[0];
                    ftpPassword = ftp.split(':')[1];
                    ftpHost = build === index_1.Build.Prod ? prod.host : projectConfig.hosts[build];
                    remoteFolder = build !== index_1.Build.Prod ? siteName + "/" : "public_html/";
                    backupFolder = build !== index_1.Build.Prod ? "__backups/" + siteName + "/" : "__backups/";
                    process.stdout.write("Connect to remote SSH-server " + ftpUser + "@" + ftpHost + "...\n");
                    return [4 /*yield*/, connect({
                            host: ftpHost,
                            password: ftpPassword,
                            userName: ftpUser,
                        })];
                case 1:
                    conn = _b.sent();
                    process.stdout.write("Connect to remote SSH-server " + ftpUser + "@" + ftpHost + " success\n\n");
                    process.stdout.write("Create backup folder " + backupFolder + "...\n");
                    return [4 /*yield*/, exec(conn, "mkdir -p " + backupFolder)];
                case 2:
                    _b.sent();
                    process.stdout.write("Create backup folder " + backupFolder + " success\n\n");
                    backup = path_1.join(backupFolder, project + "-" + moment().toISOString());
                    process.stdout.write("Try copy " + remoteFolder + " to backup " + backup + "...\n");
                    return [4 /*yield*/, exec(conn, "cp -r " + remoteFolder + " " + backup + " || :")];
                case 3:
                    _b.sent();
                    process.stdout.write("Try copy " + remoteFolder + " to backup " + backup + " success\n\n");
                    keepClean = build !== index_1.Build.Prod;
                    rsh = "sshpass -p " + ftpPassword + " ssh -oStrictHostKeyChecking=yes";
                    excluded = [
                        'wp-content/languages',
                    ];
                    if (!pullRequest) {
                        excluded.push('wp-content/uploads');
                    }
                    if (!pullRequest && build !== index_1.Build.Prod) {
                        excluded.push('pr-*');
                    }
                    exclude = excluded.map(function (e) { return "--exclude=\"" + e + "\""; });
                    rsyncArgs = [
                        '--verbose',
                        '--recursive',
                        '--links',
                        '--times',
                        '--update',
                        '--compress',
                        '--checksum',
                        '--delete-after',
                        "--rsh=\"" + rsh + "\""
                    ].concat(exclude, [
                        distDir,
                        ftpUser + "@" + ftpHost + ":" + remoteFolder,
                    ]);
                    rsyncCommand = "rsync " + rsyncArgs.join(' ');
                    process.stdout.write("Run rsync \"" + rsyncCommand + "\"...\n");
                    return [4 /*yield*/, (new Promise(function (resolve, reject) {
                            var rsync = child_process_1.spawn('rsync', rsyncArgs, {
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
                                    reject("Rsync complete with code = " + code + "\n");
                                }
                                resolve();
                            });
                        }))];
                case 4:
                    _b.sent();
                    process.stdout.write("Rsync success...\n\n");
                    return [2 /*return*/];
            }
        });
    });
}
exports.deployApp = deployApp;
var templateObject_1;
