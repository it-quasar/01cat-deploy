#!/usr/bin/env node
"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var request = require("request");
var build_1 = require("./build");
var deploy_1 = require("./deploy");
var Build;
(function (Build) {
    Build["Alpha"] = "alpha";
    Build["Beta"] = "beta";
    Build["Prod"] = "prod";
})(Build = exports.Build || (exports.Build = {}));
(function () { return __awaiter(_this, void 0, void 0, function () {
    var secret, repositorySlug, alpha, beta, prod, build, branch, tag, pullRequest, travisPullRequest, siteName, projectConfig, distDir;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                secret = process.env.DEPLOY_CONFIG_SECRET;
                if (!secret) {
                    throw new Error('DEPLOY_CONFIG_SECRET environment variable not found');
                }
                repositorySlug = process.env.TRAVIS_REPO_SLUG;
                if (!repositorySlug) {
                    throw new Error('TRAVIS_REPO_SLUG environment variable not found');
                }
                alpha = process.argv.indexOf('--alpha') !== -1;
                beta = process.argv.indexOf('--beta') !== -1;
                prod = process.argv.indexOf('--prod') !== -1;
                if (!alpha && !beta && !prod) {
                    throw new Error('--alpha, --beta or --prod param must be set');
                }
                if ((alpha ? 1 : 0) + (beta ? 1 : 0) + (prod ? 1 : 0) > 1) {
                    throw new Error('--alpha or --beta or --prod param only be set');
                }
                build = Build.Alpha;
                if (beta) {
                    build = Build.Beta;
                }
                if (prod) {
                    build = Build.Prod;
                }
                if (!process.env.TRAVIS_BRANCH) {
                    throw new Error('Not set TRAVIS_BRANCH');
                }
                branch = process.env.TRAVIS_BRANCH;
                tag = process.env.TRAVIS_TAG;
                if (branch !== 'master' && branch !== tag) {
                    // Не развораичваем проект для веток, отличных от master
                    process.stdout.write('TRAVIS_BRANCH is not master and TRAVIS_BRANCH != TRAVIS_TAG. Skipped build.');
                    return [2 /*return*/];
                }
                if (tag && build !== 'prod') {
                    // Не развораичваем проект для тегов, если сборка не prod
                    process.stdout.write('Build run on tag, but build not prod. Skipped build.');
                    return [2 /*return*/];
                }
                pullRequest = false;
                travisPullRequest = process.env.TRAVIS_PULL_REQUEST;
                if (travisPullRequest) {
                    pullRequest = travisPullRequest !== 'false' ? pullRequest : false;
                }
                siteName = getSiteName(repositorySlug, pullRequest, build);
                return [4 /*yield*/, getProjectConfig(secret, repositorySlug)];
            case 1:
                projectConfig = _a.sent();
                // Соберем приложение
                process.stdout.write(chalk_1.default(templateObject_1 || (templateObject_1 = __makeTemplateObject(["{green BUILD APP}\n"], ["{green BUILD APP}\\n"]))));
                return [4 /*yield*/, build_1.buildApp({ projectConfig: projectConfig, siteName: siteName, build: build, pullRequest: pullRequest })];
            case 2:
                distDir = _a.sent();
                process.stdout.write(chalk_1.default(templateObject_2 || (templateObject_2 = __makeTemplateObject(["{green BUILD APP SUCCESS}\n\n"], ["{green BUILD APP SUCCESS}\\n\\n"]))));
                // Развернем приложение
                process.stdout.write(chalk_1.default(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{green DEPLOY APP}\n"], ["{green DEPLOY APP}\\n"]))));
                return [4 /*yield*/, deploy_1.deployApp({ projectConfig: projectConfig, siteName: siteName, distDir: distDir, pullRequest: pullRequest, build: build })];
            case 3:
                _a.sent();
                process.stdout.write(chalk_1.default(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{green DEPLOY APP SUCCESS}\n\n"], ["{green DEPLOY APP SUCCESS}\\n\\n"]))));
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); })();
function getProjectConfig(secret, repositorySlug) {
    var url = "https://beta.01kit.ru/deploy-config.php?secret=" + secret + "&project=" + repositorySlug;
    return new Promise(function (resolve, reject) {
        request({
            json: true,
            url: url,
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                if (body.success === false) {
                    reject(body.message);
                }
                else {
                    resolve(__assign({}, body.data, { projectName: repositorySlug.split('/')[1] }));
                }
            }
        });
    });
}
function getSiteName(repositorySlug, pullRequest, build) {
    if (build === 'prod') {
        return '';
    }
    else {
        var siteName = '';
        siteName = repositorySlug.split('/')[1];
        return pullRequest ? siteName + "/pr-" + pullRequest : siteName;
    }
    return '';
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
