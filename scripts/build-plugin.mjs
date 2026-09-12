#!/usr/bin/env node
/**
 * 插件构建脚本：把插件工程编译为自包含 IIFE 插件包（index.js + plugin.json）。
 *
 * 用法：
 *   node scripts/build-plugin.mjs <pluginDir> [outBase]   # 编译单个插件到 <outBase>/<id>/
 *   node scripts/build-plugin.mjs --examples              # 编译仓内示例到 tmp/plugins/
 *
 * 说明：
 *   - <pluginDir> 为含 src/index.ts 与 plugin.json 的插件工程目录（相对仓库根）；
 *   - 产物目录按 plugin.json 的 id 命名，便于直接拷贝为 HA /local 目录结构或被上传；
 *   - 复用仓库根依赖（Vite/Vue），无需插件自带构建工具链；
 *   - 实际编译逻辑委托给 vite.plugin.config.ts（经 PLUGIN_DIR / PLUGIN_OUT 环境变量传参）。
 */
import { build } from 'vite';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 仓内示例工程（供 build:plugin:examples 端到端验证） */
const EXAMPLES = [{ dir: 'plugin-template', out: 'tmp/plugins' }];

/** 校验插件 id 规则（与宿主前后端同口径） */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * 编译单个插件工程。
 * @param {string} pluginDir 插件工程目录（相对仓库根）
 * @param {string} outBase 产物基目录（其下再按插件 id 建子目录）
 */
async function buildOne(pluginDir, outBase) {
  const absDir = resolve(root, pluginDir);
  const manifestPath = resolve(absDir, 'plugin.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`未找到插件清单：${manifestPath}`);
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const id = manifest.id;
  if (!id || !ID_PATTERN.test(id)) {
    throw new Error(`plugin.json 的 id 非法（需匹配 ^[a-z0-9][a-z0-9-]{0,63}$）：${id}`);
  }

  const outDir = resolve(root, outBase, id);
  await mkdir(outDir, { recursive: true });

  // 经环境变量把目标目录传给 vite.plugin.config.ts
  process.env.PLUGIN_DIR = pluginDir;
  process.env.PLUGIN_OUT = outDir;

  await build({ configFile: resolve(root, 'vite.plugin.config.ts') });

  // 拷贝清单到产物目录（与 index.js 同级，构成完整插件包）
  await cp(manifestPath, resolve(outDir, 'plugin.json'));

  console.log(`[build-plugin] ✔ ${id} → ${outDir}`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv[0] === '--examples') {
    for (const ex of EXAMPLES) {
      await buildOne(ex.dir, ex.out);
    }
    return;
  }

  const [pluginDir, outBase = '.'] = argv;
  if (!pluginDir) {
    console.error('用法：node scripts/build-plugin.mjs <pluginDir> [outBase]');
    console.error('      node scripts/build-plugin.mjs --examples');
    process.exit(1);
  }
  await buildOne(pluginDir, outBase);
}

main().catch((err) => {
  console.error('[build-plugin] 失败：', err?.message || err);
  process.exit(1);
});
