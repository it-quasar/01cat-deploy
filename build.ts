import { spawn } from 'child_process';
import { lstatSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'fs';
import { sync } from 'glob';
import { basename, join } from 'path';
import request = require('request');
import { Build, IProjectConfig } from './index';
import * as rimraf from 'rimraf';

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

function getWPSalt(): Promise<string> {
  return new Promise(resolve => {
    request('https://api.wordpress.org/secret-key/1.1/salt/', (error, response, body) => {
      if (!error && response.statusCode === 200) {
        resolve(body);
      }
    });
  });
}

async function copyTemplateFiles(
  options: IBuildOptions,
  distDir: string): Promise<void> {
  const { projectConfig, siteName, pullRequest, build } = options;
  // Получим соли для WP
  const salt = await getWPSalt();

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

    const newFileContent = await prepareTemplateFile(options, file, salt);
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
                                   salt: string,
): Promise<string> {
  const project = projectConfig.project;
  const db = project.db[build === 'alpha' ? 'alpha' : 'prod'];
  const dbArray = db.split(':');
  const dbUser = dbArray[0];
  const dbName = dbArray[0];
  const dbPassword = dbArray[1];

  const wpDebug = build === 'alpha' ? 'true' : 'false';

  const fileContent = readFileSync(file, 'utf-8');
  return fileContent
    .replace(/%SITE_NAME%/g, siteName)
    .replace(/%DB_NAME%/g, dbName)
    .replace(/%DB_USER%/g, dbUser)
    .replace(/%DB_PASSWORD%/g, dbPassword)
    .replace(/%UNIQUE_KEYS_AND_SALTS%/g, salt)
    .replace(/%WP_DEBUG%/g, wpDebug);
}
