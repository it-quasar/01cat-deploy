#!/usr/bin/env node

import chalk from 'chalk';
import * as request from 'request';
import { buildApp } from './build';
import { deployApp } from './deploy';
import { exists } from 'fs';

export interface IProjectConfig {
  hosts: {
    alpha: string;
    beta: string;
  };
  ftp: {
    alpha: string;
    beta: string;
  };
  project: {
    db: {
      alpha: string;
      prod: string;
    };
    prod?: {
      ftp: string;
      host: string;
    }
  };
}

interface ISuccessJsonRequest<T> {
  success: true;
  data: T;
}

interface IErrorJsonRequest {
  success: false;
  message: string;
}

type JsonRequest<T> = ISuccessJsonRequest<T> | IErrorJsonRequest;

export enum Build {
  Alpha = 'alpha',
  Beta = 'beta',
  Prod = 'prod',
}

(async () => {
  // Получим секрет
  const secret = process.env.DEPLOY_CONFIG_SECRET;
  if (!secret) {
    throw new Error('DEPLOY_CONFIG_SECRET environment variable not found');
  }

  // Получим слаг репозитория
  const repositorySlug = process.env.TRAVIS_REPO_SLUG;
  if (!repositorySlug) {
    throw new Error('TRAVIS_REPO_SLUG environment variable not found');
  }

  // Получим тип соборки
  const alpha = process.argv.indexOf('--alpha') !== -1;
  const beta = process.argv.indexOf('--beta') !== -1;
  const prod = process.argv.indexOf('--prod') !== -1;
  if (!alpha && !beta && !prod) {
    throw new Error('--alpha, --beta or --prod param must be set');
  }
  if ((alpha ? 1 : 0) + (beta ? 1 : 0) + (prod ? 1 : 0) > 1) {
    throw new Error('--alpha or --beta or --prod param only be set');
  }
  let build: Build = Build.Alpha;
  if (beta) {
    build = Build.Beta;
  }
  if (prod) {
    build = Build.Prod;
  }

  if (!process.env.TRAVIS_BRANCH) {
    throw new Error('Not set TRAVIS_BRANCH');
  }
  // Получим ветку
  const branch: string = process.env.TRAVIS_BRANCH;

  // Получим тег
  const tag = process.env.TRAVIS_TAG;
  if (branch !== 'master' && branch !== tag) {
    // Не развораичваем проект для веток, отличных от master
    process.stdout.write('TRAVIS_BRANCH is not master and TRAVIS_BRANCH != TRAVIS_TAG. Skipped build.');
    return;
  }
  if (tag && build !== 'prod') {
    // Не развораичваем проект для тегов, если сборка не prod
    process.stdout.write('Build run on tag, but build not prod. Skipped build.');
    return;
  }

  // Получим PR
  let pullRequest: false | string = false;
  const travisPullRequest = process.env.TRAVIS_PULL_REQUEST;
  if (travisPullRequest) {
    pullRequest = travisPullRequest !== 'false' ? pullRequest : false;
  }

  // Вычислим имя сайта. Имя сайта не заканчивается на /
  const siteName = getSiteName(repositorySlug, pullRequest, build);

  // Загрузим конфиг сборки
  const projectConfig = await getProjectConfig(secret, repositorySlug);

  // Соберем приложение
  process.stdout.write(chalk`{green BUILD APP}\n`);
  const distDir = await buildApp({projectConfig, siteName, build, pullRequest});
  process.stdout.write(chalk`{green BUILD APP SUCCESS}\n\n`);

  // Развернем приложение
  process.stdout.write(chalk`{green DEPLOY APP}\n`);
  await deployApp({projectConfig, siteName, distDir, pullRequest, build});
  process.stdout.write(chalk`{green DEPLOY APP SUCCESS}\n\n`);

  process.exit(0);
})();

function getProjectConfig(secret: string, repositorySlug: string): Promise<IProjectConfig> {
  const url = `https://beta.01kit.ru/deploy-config.php?secret=${secret}&project=${repositorySlug}`;

  return new Promise((resolve, reject) => {
    request({
      json: true,
      url,
    }, (error, response, body: JsonRequest<IProjectConfig>) => {
      if (!error && response.statusCode === 200) {
        if (body.success === false) {
          reject(body.message);
        } else {
          resolve(body.data);
        }
      }
    });
  });
}

function getSiteName(repositorySlug: string, pullRequest: string | false, build: Build): string {
  if (build === 'prod') {
    return '';
  } else {
    let siteName = '';
    siteName = repositorySlug.split('/')[1];
    return pullRequest ? `${siteName}/pr-${pullRequest}` : siteName;
  }

  return '';
}
