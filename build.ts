import { spawn } from 'child_process';
import { lstatSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'fs';
import { sync } from 'glob';
import { basename, join } from 'path';
import * as rimraf from 'rimraf';
import { Build, IProjectConfig } from './index';

interface IBuildOptions {
  projectConfig: IProjectConfig;
  siteName: string;
  build: Build;
  pullRequest: false | string;
}

/**
 * Собирает проект и возвращает путь к папке с собранным проектом
 */
export async function buildApp(options: IBuildOptions): Promise<string> {
  const { siteName, build } = options;
  const wpBuildBuildOptions = [
    'build',
  ];

  if (build !== Build.Alpha) {
    wpBuildBuildOptions.push('--prod');
  }

  if (build !== Build.Prod) {
    wpBuildBuildOptions.push(`--deploy-url=${siteName}`);
  }

  const wpBuildBuildCommand = `wpbuild ${wpBuildBuildOptions.join(' ')}`;
  process.stdout.write(`Run wpbuild "${wpBuildBuildCommand}"...\n`);
  await (new Promise((resolve, reject) => {
    const rsync = spawn(join(process.cwd(), 'node_modules', '.bin', 'wpbuild'), wpBuildBuildOptions, {
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

  const distDir = join(process.cwd(), 'dist');

  // Скопируем файлы-шаблоны
  await copyTemplateFiles(options, distDir);

  // Удалим ненужные фалы и папки WP
  process.stdout.write(`Remove default wp-content...\n`);
  rimraf.sync(join(distDir, 'wordpress', 'wp-content'));
  process.stdout.write(`Remove default wp-content success...\n`);

  return distDir;
}

function getRandomString(count: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < count; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function getWPSalt(build: Build): string {
  if (build !== Build.Prod) {
    return `define('AUTH_KEY',         'put your unique phrase here');\n`
      + `define('SECURE_AUTH_KEY',  'put your unique phrase here');\n`
      + `define('LOGGED_IN_KEY',    'put your unique phrase here');\n`
      + `define('NONCE_KEY',        'put your unique phrase here');\n`
      + `define('AUTH_SALT',        'put your unique phrase here');\n`
      + `define('SECURE_AUTH_SALT', 'put your unique phrase here');\n`
      + `define('LOGGED_IN_SALT',   'put your unique phrase here');\n`
      + `define('NONCE_SALT',       'put your unique phrase here');\n`;
  } else {
    return `define('AUTH_KEY',         '${getRandomString(20)}');\n`
      + `define('SECURE_AUTH_KEY',  '${getRandomString(20)}');\n`
      + `define('LOGGED_IN_KEY',    '${getRandomString(20)}');\n`
      + `define('NONCE_KEY',        '${getRandomString(20)}');\n`
      + `define('AUTH_SALT',        '${getRandomString(20)}');\n`
      + `define('SECURE_AUTH_SALT', '${getRandomString(20)}');\n`
      + `define('LOGGED_IN_SALT',   '${getRandomString(20)}');\n`
      + `define('NONCE_SALT',       '${getRandomString(20)}');\n`;

  }
}

async function copyTemplateFiles(
  options: IBuildOptions,
  distDir: string): Promise<void> {
  const { pullRequest } = options;

  // Найдем все файлы шаблонов
  const templateGlobResult = sync(join(__dirname, 'templates', '**/*'), { dot: true });
  const templateFiles = templateGlobResult.filter(file => {
    const stat = lstatSync(file);
    return stat.isFile();
  });

  // Подготовим файлы из шаблонов
  for (const file of templateFiles) {
    const newFileName = basename(file);
    const newFileFullPath = join(distDir, newFileName);
    try {
      unlinkSync(newFileFullPath);
    } catch (e) {
      // Ничего не делаем
    }

    const newFileContent = await prepareTemplateFile(options, file);
    writeFileSync(newFileFullPath, newFileContent);
    process.stdout.write(`Created file ${newFileFullPath}\n`);
  }

  // Для PR создадим ссылку на wp-content/uploads
  if (pullRequest) {
    const newFileFullPath = join(distDir, 'wp-content', 'uploads');
    try {
      unlinkSync(newFileFullPath);
    } catch (e) {
      // Ничего не делаем
    }

    symlinkSync('../../wp-content/uploads', newFileFullPath);
    process.stdout.write(`Created symlink ${newFileFullPath}\n`);
  }
}

async function prepareTemplateFile({ projectConfig, build, siteName }: IBuildOptions,
                                   file: string,
): Promise<string> {
  const project = projectConfig.project;
  const db = project.db[build === Build.Alpha ? 'alpha' : 'prod'];
  const dbName = db.name;
  const dbPassword = db.password;
  const dbHost = db.host || 'localhost';
  const dbUser = db.user || dbName;

  let publicPath = '';
  if (build === Build.Prod) {
    if (!project.prod) {
      throw new Error('Not found project.prod config');
    }
    publicPath = project.prod.path;
  } else {
    publicPath = projectConfig.ftp[build].path;
  }

  const salt = getWPSalt(build);

  const wpDebug = build === Build.Alpha ? 'true' : 'false';

  const fileContent = readFileSync(file, 'utf-8');
  return fileContent
    .replace(/%SITE_NAME%/g, siteName)
    .replace(/%DB_NAME%/g, dbName)
    .replace(/%DB_USER%/g, dbUser)
    .replace(/%DB_HOST%/g, dbHost)
    .replace(/%DB_PASSWORD%/g, dbPassword)
    .replace(/%WP_DEBUG%/g, wpDebug)
    .replace(/%PUBLIC_PATH%/g, publicPath)
    .replace(/%UNIQUE_KEYS_AND_SALTS%/g, salt);
}
