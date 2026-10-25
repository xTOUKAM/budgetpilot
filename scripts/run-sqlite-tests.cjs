const { spawnSync } = require('node:child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronRebuild = process.platform === 'win32' ? 'node_modules\\.bin\\electron-rebuild.cmd' : 'node_modules/.bin/electron-rebuild';
const env = { ...process.env, PYTHON: process.env.PYTHON || 'C:\\Users\\xtouk\\AppData\\Local\\Programs\\Python\\Python311\\python.exe' };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32', ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const rebuildStatus = run(npm, ['rebuild', 'better-sqlite3']);
let testStatus = rebuildStatus;
try {
  if (rebuildStatus === 0) testStatus = run(process.execPath, ['--test', 'tests/sqlite.integration.test.cjs'], { shell: false });
} finally {
  const electronStatus = run(electronRebuild, ['--force', '--only', 'better-sqlite3', '--module-dir', '.']);
  if (testStatus === 0 && electronStatus !== 0) testStatus = electronStatus;
}
process.exit(testStatus);
