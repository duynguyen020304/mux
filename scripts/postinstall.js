#!/usr/bin/env node
// Conditional postinstall script for native modules.
// Cross-platform replacement for scripts/postinstall.sh (works in Windows PowerShell).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const electronPath = path.join(projectRoot, 'node_modules', 'electron');
const nodePtyPath = path.join(projectRoot, 'node_modules', 'node-pty');
const duckdbNodeApiPath = path.join(projectRoot, 'node_modules', '@duckdb', 'node-api');
const duckdbNodeBindingsPath = path.join(projectRoot, 'node_modules', '@duckdb', 'node-bindings');

function exists(p) {
  return fs.existsSync(p);
}

function readPackageVersion(pkgPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function findCommand(candidates) {
  for (const command of candidates) {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore', shell: true });
    if (result.status === 0) return command;
  }
  return null;
}

function rebuild(command, modulePath) {
  return spawnSync(command, ['@electron/rebuild', '-f', '-m', modulePath], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  }).status === 0;
}

if (process.env.MUX_HEADLESS === '1') {
  console.log('🖥️  Headless mode – skipping native rebuild');
  process.exit(0);
}

if ((process.env.INIT_CWD || projectRoot) !== projectRoot) {
  console.log('📦 mux installed as a dependency – skipping native rebuild');
  process.exit(0);
}

if (!exists(electronPath)) {
  console.log('🌐 Server mode detected (Electron missing) – skipping native rebuild');
  process.exit(0);
}

const hasNodePty = exists(nodePtyPath);
const hasDuckdb = exists(duckdbNodeApiPath) && exists(duckdbNodeBindingsPath);

if (!hasNodePty && !hasDuckdb) {
  console.log('🌐 Native modules missing – skipping native rebuild');
  process.exit(0);
}

const electronVersion = readPackageVersion(electronPath);
const nodePtyVersion = readPackageVersion(nodePtyPath);
const duckdbVersion = readPackageVersion(duckdbNodeApiPath);
const platform = os.platform();
const arch = os.arch();
const stampDir = path.join(projectRoot, 'node_modules', '.cache', 'mux-native');
const nodePtyStampFile = path.join(stampDir, `node-pty-${electronVersion}-${nodePtyVersion}-${platform}-${arch}.stamp`);
const duckdbStampFile = path.join(stampDir, `duckdb-${electronVersion}-${duckdbVersion}-${platform}-${arch}.stamp`);

fs.mkdirSync(stampDir, { recursive: true });

const rebuildCommand = findCommand(['npx', 'bunx']);
if (!rebuildCommand) {
  console.log('⚠️  Neither npx nor bunx found - cannot rebuild native modules');
  console.log('   Terminal functionality may not work in desktop mode.');
  console.log("   Run 'make rebuild-native' manually to fix.");
  process.exit(0);
}

if (hasNodePty) {
  if (exists(nodePtyStampFile)) {
    console.log(`✅ node-pty already rebuilt for Electron ${electronVersion} on ${platform}/${arch} – skipping`);
  } else {
    console.log(`🔧 Rebuilding node-pty for Electron ${electronVersion} on ${platform}/${arch}...`);
    if (!rebuild(rebuildCommand, 'node_modules/node-pty')) {
      console.log('⚠️  Failed to rebuild native modules');
      console.log('   Terminal functionality may not work in desktop mode.');
      console.log("   Run 'make rebuild-native' manually to fix.");
      process.exit(0);
    }
    fs.writeFileSync(nodePtyStampFile, '');
    console.log(`✅ node-pty rebuilt successfully (cached at ${nodePtyStampFile})`);
  }
} else {
  console.log('ℹ️  node-pty package missing – skipping node-pty rebuild');
}

if (hasDuckdb) {
  if (exists(duckdbStampFile)) {
    console.log(`✅ DuckDB already rebuilt for Electron ${electronVersion} on ${platform}/${arch} – skipping`);
  } else {
    console.log(`🔧 Rebuilding DuckDB for Electron ${electronVersion} on ${platform}/${arch}...`);
    if (!rebuild(rebuildCommand, 'node_modules/@duckdb/node-bindings')) {
      console.log('⚠️  Failed to rebuild native modules');
      console.log('   Terminal functionality may not work in desktop mode.');
      console.log("   Run 'make rebuild-native' manually to fix.");
      process.exit(0);
    }
    fs.writeFileSync(duckdbStampFile, '');
    console.log(`✅ DuckDB rebuilt successfully (cached at ${duckdbStampFile})`);
  }
} else {
  console.log('ℹ️  DuckDB packages missing – skipping DuckDB rebuild');
}
