import { describe, it, expect } from 'vitest';
import {
  MAX_JS_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_RECORD_BYTES,
  MAX_PLUGINS,
  PLUGIN_ID_PATTERN,
  isValidPluginId,
  checkScriptFile,
  checkManifestFile,
  checkScriptContent,
  checkRecordSize,
  checkEntryPath,
  checkPluginCount,
} from '../core/pluginLimits';

/**
 * 插件限额纯函数单测：覆盖类型白名单、大小/数量上限（含「恰好等于上限」与
 * 「超 1 字节」边界）、id 正则、entry 路径穿越与内容校验，确保前后端同口径。
 */

describe('isValidPluginId', () => {
  it('接受合法 id（小写字母数字起头，含连字符）', () => {
    expect(isValidPluginId('a')).toBe(true);
    expect(isValidPluginId('pixel')).toBe(true);
    expect(isValidPluginId('my-face-01')).toBe(true);
    expect(isValidPluginId('0abc')).toBe(true);
    expect(isValidPluginId('a'.repeat(64))).toBe(true);
  });

  it('拒绝非法 id（大写/下划线/空/首尾连字符/超长）', () => {
    expect(isValidPluginId('')).toBe(false);
    expect(isValidPluginId('Pixel')).toBe(false);
    expect(isValidPluginId('pixel_x')).toBe(false);
    expect(isValidPluginId('-pixel')).toBe(false);
    expect(isValidPluginId('pixel.')).toBe(false);
    expect(isValidPluginId('a'.repeat(65))).toBe(false);
    expect(isValidPluginId('像素')).toBe(false);
  });

  it('导出 id 正则且与校验一致', () => {
    expect(PLUGIN_ID_PATTERN.test('pixel')).toBe(true);
    expect(PLUGIN_ID_PATTERN.test('Bad')).toBe(false);
  });
});

describe('checkScriptFile（类型白名单 + 大小上限）', () => {
  it('接受 .js（大小写不敏感）且不超限', () => {
    expect(checkScriptFile({ name: 'index.js', size: 10 }).ok).toBe(true);
    expect(checkScriptFile({ name: 'INDEX.JS', size: 10 }).ok).toBe(true);
  });

  it('恰好等于上限通过，超 1 字节拒绝', () => {
    expect(checkScriptFile({ name: 'index.js', size: MAX_JS_BYTES }).ok).toBe(true);
    const over = checkScriptFile({ name: 'index.js', size: MAX_JS_BYTES + 1 });
    expect(over.ok).toBe(false);
    expect(over.error).toContain('KB');
  });

  it('拒绝非 .js 后缀与无后缀文件', () => {
    expect(checkScriptFile({ name: 'evil.html', size: 1 }).ok).toBe(false);
    expect(checkScriptFile({ name: 'evil.jsx', size: 1 }).ok).toBe(false);
    expect(checkScriptFile({ name: 'noext', size: 1 }).ok).toBe(false);
  });
});

describe('checkManifestFile（清单类型 + 大小上限）', () => {
  it('接受 .json 且边界正确', () => {
    expect(checkManifestFile({ name: 'plugin.json', size: 10 }).ok).toBe(true);
    expect(checkManifestFile({ name: 'plugin.json', size: MAX_MANIFEST_BYTES }).ok).toBe(true);
    expect(checkManifestFile({ name: 'plugin.json', size: MAX_MANIFEST_BYTES + 1 }).ok).toBe(false);
    expect(checkManifestFile({ name: 'plugin.txt', size: 1 }).ok).toBe(false);
  });
});

describe('checkScriptContent（内容校验）', () => {
  it('接受普通脚本', () => {
    expect(checkScriptContent('console.log(1)').ok).toBe(true);
  });

  it('拒绝空/纯空白脚本', () => {
    expect(checkScriptContent('').ok).toBe(false);
    expect(checkScriptContent('   \n\t ').ok).toBe(false);
  });

  it('拒绝含 NUL 字节的二进制内容', () => {
    const bad = checkScriptContent('var a = 1;\u0000rest');
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('NUL');
  });
});

describe('checkRecordSize（单条记录总量）', () => {
  it('总量恰好等于上限通过，超 1 字节拒绝', () => {
    expect(checkRecordSize(MAX_RECORD_BYTES, 0).ok).toBe(true);
    expect(checkRecordSize(MAX_RECORD_BYTES - 100, 100).ok).toBe(true);
    expect(checkRecordSize(MAX_RECORD_BYTES, 1).ok).toBe(false);
  });

  it('缺省清单字节按 0 计，非法入参容错', () => {
    expect(checkRecordSize(0).ok).toBe(true);
    expect(checkRecordSize(NaN as unknown as number).ok).toBe(true);
  });
});

describe('checkEntryPath（防路径穿越）', () => {
  it('接受纯 .js 文件名', () => {
    expect(checkEntryPath('index.js').ok).toBe(true);
  });

  it('拒绝 .. / 绝对路径 / 反斜杠 / 非 .js', () => {
    expect(checkEntryPath('../evil.js').ok).toBe(false);
    expect(checkEntryPath('a/../b.js').ok).toBe(false);
    expect(checkEntryPath('/etc/passwd.js').ok).toBe(false);
    expect(checkEntryPath('a\\b.js').ok).toBe(false);
    expect(checkEntryPath('index.txt').ok).toBe(false);
    expect(checkEntryPath('').ok).toBe(false);
  });
});

describe('checkPluginCount（数量上限）', () => {
  it('恰好等于上限拒绝，低于上限通过', () => {
    expect(checkPluginCount(0).ok).toBe(true);
    expect(checkPluginCount(MAX_PLUGINS - 1).ok).toBe(true);
    expect(checkPluginCount(MAX_PLUGINS).ok).toBe(false);
    expect(checkPluginCount(MAX_PLUGINS + 5).ok).toBe(false);
  });
});
