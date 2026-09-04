const { default: EmbeddedPostgres } = require('embedded-postgres');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function main() {
  const dbDir = path.resolve(__dirname, '../.disposable-test-db');
  if (fs.existsSync(dbDir)) {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('====================================================');
  console.log('SPAWNING DISPOSABLE LOCAL POSTGRESQL (127.0.0.1:54322)');
  console.log('====================================================');

  const pg = new EmbeddedPostgres({
    port: 54322,
    databaseDir: dbDir,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  await pg.initialise();
  await pg.start();
  console.log('✅ Disposable PostgreSQL started successfully on 127.0.0.1:54322\n');

  const env = {
    ...process.env,
    DATABASE_URL_TEST: 'postgresql://postgres:password@127.0.0.1:54322/postgres',
    KLYVO_RLS_TEST_DB: '1',
    KLYVO_WEBHOOK_TEST_DB: '1',
  };

  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  console.log('RUNNING: npm run verify:sprint4');
  console.log('----------------------------------------------------');

  const child = spawn(npmCmd, ['run', 'verify:sprint4'], {
    env,
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    shell: true,
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
    child.on('error', (err) => {
      console.error('Child process error:', err);
      resolve(1);
    });
  });

  console.log('----------------------------------------------------');
  console.log('SHUTTING DOWN DISPOSABLE POSTGRESQL SERVER...');
  try {
    await pg.stop();
  } catch (_) {}
  console.log('✅ Disposable PostgreSQL stopped cleanly.\n');

  process.exit(exitCode || 0);
}

main().catch((err) => {
  console.error('Fatal error in disposable DB verification gate:', err);
  process.exit(1);
});
