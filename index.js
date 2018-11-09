#!/usr/bin/env node

const request = require('request');
const glob = require('glob');
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

(async () => {
  const secret = process.env.DEPLOY_CONFIG_SECRET;

  if (!secret) {
    throw new Error('DEPLOY_CONFIG_SECRET environment variable not found');
  }

  const repoSlug = process.env.TRAVIS_REPO_SLUG;

  if (!repoSlug) {
    throw new Error('TRAVIS_REPO_SLUG environment variable not found');
  }

  const alpha = process.argv.indexOf('--alpha') !== -1;
  const beta = process.argv.indexOf('--beta') !== -1;
  const prod = process.argv.indexOf('--prod') !== -1;

  if (!alpha && !beta && !prod) {
    throw new Error('--alpha, --beta or --prod param must be set');
  }

  if (alpha + beta + prod > 1) {
    throw new Error('--alpha or --beta or --prod param only be set');
  }

  let build = 'alpha';
  if (beta) {
    build = 'beta';
  }
  if (prod) {
    build = 'prod';
  }

  const url = `https://beta.01kit.ru/deploy-config.php?secret=${secret}&project=${repoSlug}`;

  const projectConfig = await new Promise(resolve => {
    request({
      url,
      json: true,
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        resolve(body);
      }
    });
  });

  const salt = await new Promise(resolve => {
    request('https://api.wordpress.org/secret-key/1.1/salt/', (error, response, body) => {
      if (!error && response.statusCode === 200) {
        resolve(body);
      }
    });
  });

  const globResult = glob.sync(path.join(__dirname, 'templates', '**/*'), {dot: true});
  const files = globResult.filter(file => {
    const stat = fs.lstatSync(file);
    return stat.isFile();
  });

  const dir = path.join(process.cwd(), 'dist');
  let pullRequest = process.env.TRAVIS_PULL_REQUEST;
  if (pullRequest) {
    pullRequest = pullRequest !== 'false' ? pullRequest : false;
  }
  const branch = process.env.TRAVIS_BRANCH;
  if (branch !== 'master') {
    // Не развораичваем проект для веток, отличных от master
    process.stdout.write('TRAVIS_BRANCH is not master. Skipped build.');
    return;
  }

  const siteName = repoSlug.split('/')[1];
  const siteFullName = pullRequest ? `${siteName}/pr-${pullRequest}` : siteName;

  // Соберем приложение
  const wpBuildBuildOptions = [
    'build',
  ];

  if (build !== 'alpha') {
    wpBuildBuildOptions.push('--prod');
  }

  if (build !== 'prod') {
    wpBuildBuildOptions.push(`--deploy-url=${siteFullName}`);
  }

  const wpBuildBuildCommand = `wpbuild ${wpBuildBuildOptions.join(' ')}`;
  process.stdout.write(`Run wpbuild "${wpBuildBuildCommand}"...\n`);
  await (new Promise((resolve, reject) => {
    const rsync = childProcess.spawn(path.join(process.cwd(), 'node_modules', '.bin', 'wpbuild'), wpBuildBuildOptions, {
      shell: true,
    });

    rsync.stdout.on('data', data => {
      process.stdout.write(data.toString());
    });

    rsync.stderr.on('data', data => {
      process.stderr.write(data.toString());
    });

    rsync.on('exit', code => {
      if (code !== 0) {
        reject(`Wpbuild complete with code = ${code}\n`);
      }

      resolve();
    });
  }));
  process.stdout.write(`Wpbuild success...\n\n`);

  // Подготовим файлы из шаблонов
  for (const file of files) {
    const newFileName = path.basename(file);
    const newFileFullPath = path.join(dir, newFileName);
    try {
      fs.unlinkSync(newFileFullPath);
    } catch (e) {
      // Ничего не делаем
    }

    const newFileContent = await prepareTemplate(file, repoSlug, projectConfig, build, salt, siteFullName);
    fs.writeFileSync(newFileFullPath, newFileContent);
    process.stdout.write(`Created file ${newFileFullPath}\n`);
  }

  // Для PR создадим ссылку на wp-content/uploads
  if (pullRequest) {
    const newFileFullPath = path.join(dir, 'wp-content', 'uploads');
    try {
      fs.unlinkSync(newFileFullPath);
    } catch (e) {
      // Ничего не делаем
    }

    fs.symlinkSync('../../wp-content/uploads', newFileFullPath);
    process.stdout.write(`Created symlink ${newFileFullPath}\n`);
  }

  const project = projectConfig.data.project;
  // Развернем приложение
  const ftp = build === 'prod' ? project.prod.ftp : projectConfig.data.ftp[build];
  const ftpUser = ftp.split(':')[0];
  const ftpPassword = ftp.split(':')[1];
  const host = build === 'prod' ? project.prod.host : projectConfig.data.hosts[build];

  const remoteFolder = build !== 'prod' ? `${siteFullName}/` : `public_html`;
  const backupFolder = build !== 'prod' ? `__backups/${siteFullName}` : `__backups`;

  const wpBuildDeployOptions = [
    'ssh-deploy',
    `--user="${ftpUser}"`,
    `--password="${ftpPassword}"`,
    `--host="${host}"`,
    `--remote-folder="${remoteFolder}"`,
    `--backup-folder="${backupFolder}"`,
    '--method=rsync',
    '--exclude="wp-content/languages"',
  ];

  if (!pullRequest) {
    wpBuildDeployOptions.push('--exclude="wp-content/uploads"');
  }

  if (!pullRequest && build !== 'prod') {
    wpBuildDeployOptions.push('--exclude="pr-*"');
  }

  if (build !== 'prod') {
    wpBuildDeployOptions.push('--keep-clean');
  }

  const wpBuildDeployCommand = `wpbuild ${wpBuildDeployOptions.join(' ')}`;
  process.stdout.write(`Run wpbuild "${wpBuildDeployCommand}"...\n`);
  await (new Promise((resolve, reject) => {
    const rsync = childProcess.spawn(path.join(process.cwd(), 'node_modules', '.bin', 'wpbuild'),
        wpBuildDeployOptions, {
          shell: true,
        });

    rsync.stdout.on('data', data => {
      process.stdout.write(data.toString());
    });

    rsync.stderr.on('data', data => {
      process.stderr.write(data.toString());
    });

    rsync.on('exit', code => {
      if (code !== 0) {
        reject(`Wpbuild complete with code = ${code}\n`);
      }

      resolve();
    });
  }));
  process.stdout.write(`Wpbuild success...\n\n`);
})();

async function prepareTemplate(file, repoSlug, projectConfig, build, salt, siteName) {
  const project = projectConfig.data.project;
  const db = project.db[build === 'alpha' ? 'alpha' : 'prod'];
  const dbArray = db.split(':');
  const dbUser = dbArray[0];
  const dbName = dbArray[0];
  const dbPassword = dbArray[1];

  const wpDebug = build === 'alpha' ? 'true' : 'false';

  const fileContent = fs.readFileSync(file, 'utf-8');
  return fileContent
      .replace(/%SITE_NAME%/g, siteName)
      .replace(/%DB_NAME%/g, dbName)
      .replace(/%DB_USER%/g, dbUser)
      .replace(/%DB_PASSWORD%/g, dbPassword)
      .replace(/%UNIQUE_KEYS_AND_SALTS%/g, salt)
      .replace(/%WP_DEBUG%/g, wpDebug);
}
