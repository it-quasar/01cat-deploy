import chalk from 'chalk';
import { spawn } from 'child_process';
import * as moment from 'moment';
import { join } from 'path';
import { Client } from 'ssh2';
import { Build, IProjectConfig } from './index';

interface IConnectOptions {
  host: string;
  userName: string;
  password: string;
}

function connect(options: IConnectOptions): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      resolve(conn);
    }).connect({
      host: options.host,
      password: options.password,
      username: options.userName,
    });
  });
}

function exec(client: Client, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(chalk`{cyan SSH exec:} ${command}\n`);

    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
      }

      stream
        .on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`SSH command exit witch code ${code}`));
          }
          resolve();
        })
        .on('data', (data: string) => {
        process.stdout.write(data);
      }).stderr.on('data', (data: string) => {
        process.stderr.write(data);
      });
    });
  });
}

interface IDeployOptions {
  projectConfig: IProjectConfig;
  siteName: string;
  distDir: string;
  pullRequest: false | string;
  build: Build;
}

export async function deployApp({projectConfig, siteName, distDir, pullRequest, build}: IDeployOptions): Promise<void> {
  const project = projectConfig.project;
  let prod = {ftp: '', host: ''};
  if (build === Build.Prod) {
    if (!project.prod) {
      throw new Error('Production config not found for ptoject');
    } else {
      prod = project.prod;
    }
  }
  const ftp = build === Build.Prod ? prod.ftp : projectConfig.ftp[build];
  const ftpUser = ftp.split(':')[0];
  const ftpPassword = ftp.split(':')[1];
  const ftpHost = build === Build.Prod ? prod.host : projectConfig.hosts[build];

  const remoteFolder = build !== Build.Prod ? `${siteName}/` : `public_html/`;
  const backupFolder = build !== Build.Prod ? `__backups/${siteName}/` : `__backups/`;

  process.stdout.write(`Connect to remote SSH-server ${ftpUser}@${ftpHost}...\n`);
  const conn = await connect({
    host: ftpHost,
    password: ftpPassword,
    userName: ftpUser,
  });
  process.stdout.write(`Connect to remote SSH-server ${ftpUser}@${ftpHost} success\n\n`);

  process.stdout.write(`Create backup folder ${backupFolder}...\n`);
  await exec(conn, `mkdir -p ${backupFolder}`);
  process.stdout.write(`Create backup folder ${backupFolder} success\n\n`);
  const backup = join(backupFolder, `${projectConfig.projectName}-${moment().toISOString()}`);

  process.stdout.write(`Try copy ${remoteFolder} to backup ${backup}...\n`);
  await exec(conn, `cp -r ${remoteFolder} ${backup} || :`);
  process.stdout.write(`Try copy ${remoteFolder} to backup ${backup} success\n\n`);

  const keepClean = build !== Build.Prod;

  const rsh = `sshpass -p ${ftpPassword} ssh -oStrictHostKeyChecking=no`;

  // Подготовим исключения
  const excluded = [
    'wp-content/languages',
  ];
  if (!pullRequest) {
    excluded.push('wp-content/uploads');
  }
  if (!pullRequest && build !== Build.Prod) {
    excluded.push('pr-*');
  }

  const exclude = excluded.map(e => `--exclude="${e}"`);

  const rsyncArgs = [
    '--verbose',
    '--recursive',
    '--links',
    '--times',
    '--update',
    '--compress',
    '--checksum',
    '--delete-after',
    `--rsh="${rsh}"`,
    ...exclude,
    `${distDir}/`,
    `${ftpUser}@${ftpHost}:${remoteFolder}`,
  ];
  const rsyncCommand = `rsync ${rsyncArgs.join(' ')}`;

  process.stdout.write(`Run rsync "${rsyncCommand}"...\n`);
  await (new Promise((resolve, reject) => {
    const rsync = spawn('rsync', rsyncArgs, {
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
        reject(`Rsync complete with code = ${code}\n`);
      }

      resolve();
    });
  }));
  process.stdout.write(`Rsync success...\n\n`);
}
