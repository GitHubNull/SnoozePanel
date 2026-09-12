"""SnoozePanel 设备级配置与插件记录存储。

封装 homeassistant.helpers.storage.Store：
- 设备级配置：按 device_id 分区读写配置记录。
- 插件记录：保存「预编译插件包」的安装记录（清单 + 可选脚本本体）。

存储结构：{"devices": {"<device_id>": {...}}, "plugins": {"<id>": {...}}}
Store 自动处理 .storage/ 原子写与 HA 重启存活。

安全定位：本模块是所有插件写入的强制校验层——无论 WS schema 是否被绕过，
落盘前一律重新校验类型/大小/数量/内容限额（与 src/core/pluginLimits.ts 同口径）。
后端绝不执行上传内容，仅存储。
"""

from __future__ import annotations

import json
import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    MAX_JS_BYTES,
    MAX_MANIFEST_BYTES,
    MAX_PLUGINS,
    MAX_RECORD_BYTES,
    PLUGIN_ID_PATTERN,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_ID_RE = re.compile(PLUGIN_ID_PATTERN)
_ALLOWED_KINDS = ("face", "widget")
_ALLOWED_CHANNELS = ("dir", "upload")


class PluginValidationError(ValueError):
    """插件记录未通过限额/内容校验（中文原因）。"""


def validate_plugin_record(record: dict[str, Any]) -> None:
    """校验收到的插件记录；不合法抛 PluginValidationError（不落盘）。

    与前端 pluginLimits.ts 对齐：类型白名单 + 大小上限 + 数量上限 + 内容校验。
    """
    if not isinstance(record, dict):
        raise PluginValidationError("插件记录格式非法")

    pid = record.get("id")
    if not isinstance(pid, str) or not _ID_RE.match(pid):
        raise PluginValidationError("插件 id 非法（仅允许小写字母/数字/连字符）")

    kind = record.get("kind")
    if kind not in _ALLOWED_KINDS:
        raise PluginValidationError("插件种类非法（仅 face / widget）")

    channel = record.get("channel")
    if channel not in _ALLOWED_CHANNELS:
        raise PluginValidationError("安装通道非法（仅 dir / upload）")

    entry = record.get("entry")
    if not isinstance(entry, str) or not entry:
        raise PluginValidationError("entry 不能为空")
    if ".." in entry or entry.startswith("/") or "\\" in entry:
        raise PluginValidationError("entry 禁止路径穿越 / 绝对路径 / 反斜杠")
    if not entry.lower().endswith(".js"):
        raise PluginValidationError("entry 必须为 .js 文件")

    manifest = record.get("manifest")
    if manifest is None:
        manifest = {}
    if not isinstance(manifest, dict):
        raise PluginValidationError("manifest 必须为对象")

    manifest_bytes = len(json.dumps(manifest, ensure_ascii=False).encode("utf-8"))
    if manifest_bytes > MAX_MANIFEST_BYTES:
        raise PluginValidationError(f"清单超过上限 {MAX_MANIFEST_BYTES // 1024} KB")

    code = record.get("code")
    code_bytes = 0
    if channel == "upload":
        if not isinstance(code, str) or code.strip() == "":
            raise PluginValidationError("上传通道缺少脚本内容")
        if "\x00" in code:
            raise PluginValidationError("脚本含二进制内容（NUL 字节），已拒绝")
        code_bytes = len(code.encode("utf-8"))
        if code_bytes > MAX_JS_BYTES:
            raise PluginValidationError(f"脚本超过上限 {MAX_JS_BYTES // 1024} KB")
    elif code not in (None, ""):
        raise PluginValidationError("dir 通道不应携带脚本内容")

    if code_bytes + manifest_bytes > MAX_RECORD_BYTES:
        raise PluginValidationError(f"安装记录超过上限 {MAX_RECORD_BYTES // 1024} KB")


class _PluginStore(Store[dict[str, Any]]):
    """Store 子类：版本升级时把旧数据补齐 plugins 分区。"""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """迁移旧版本数据：v1 无 plugins 分区，补空分区即可。"""
        if not isinstance(old_data, dict):
            return {"devices": {}, "plugins": {}}
        old_data.setdefault("devices", {})
        old_data.setdefault("plugins", {})
        return old_data


class SnoozeStorage:
    """设备级配置与插件记录的读写封装。"""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = _PluginStore(
            hass, STORAGE_VERSION, STORAGE_KEY, atomic_writes=True
        )
        self._data: dict[str, Any] = {"devices": {}, "plugins": {}}

    async def async_load(self) -> None:
        """从 .storage/ 加载（HA 启动时调用一次）。"""
        data = await self._store.async_load()
        devices = data.get("devices") if isinstance(data, dict) else None
        plugins = data.get("plugins") if isinstance(data, dict) else None
        self._data = {
            "devices": devices if isinstance(devices, dict) else {},
            "plugins": plugins if isinstance(plugins, dict) else {},
        }

    # ---- 设备级配置 ----

    def get_config(self, device_id: str) -> dict[str, Any] | None:
        """读取某设备的配置覆盖，无则返回 None。"""
        cfg = self._data["devices"].get(device_id)
        return cfg if isinstance(cfg, dict) else None

    def list_devices(self) -> list[str]:
        """返回所有已存设备 id。"""
        return sorted(self._data["devices"].keys())

    async def async_set_config(self, device_id: str, config: dict[str, Any]) -> None:
        """写入某设备的配置覆盖并落盘。"""
        self._data["devices"][device_id] = config
        await self._store.async_save(self._data)

    async def async_delete_config(self, device_id: str) -> bool:
        """删除某设备配置，返回是否确有删除。"""
        if device_id in self._data["devices"]:
            del self._data["devices"][device_id]
            await self._store.async_save(self._data)
            return True
        return False

    # ---- 插件安装记录 ----

    def list_plugins(self) -> list[dict[str, Any]]:
        """返回全部插件安装记录（按 id 升序）。"""
        plugins = self._data["plugins"]
        return [plugins[k] for k in sorted(plugins.keys())]

    def get_plugin(self, plugin_id: str) -> dict[str, Any] | None:
        """读取某插件记录，无则返回 None。"""
        rec = self._data["plugins"].get(plugin_id)
        return rec if isinstance(rec, dict) else None

    async def async_install_plugin(self, record: dict[str, Any]) -> None:
        """安装（或覆盖）一条插件记录。

        强制校验限额：类型 / entry 路径 / 大小 / 内容 / 数量。超限抛错且不落盘。
        """
        plugins = self._data["plugins"]
        pid = record.get("id") if isinstance(record, dict) else None
        is_new = isinstance(pid, str) and pid not in plugins
        validate_plugin_record(record)
        if is_new and len(plugins) >= MAX_PLUGINS:
            raise PluginValidationError(f"已达插件数量上限（{MAX_PLUGINS} 个）")
        plugins[pid] = record
        await self._store.async_save(self._data)

    async def async_uninstall_plugin(self, plugin_id: str) -> bool:
        """卸载指定插件，返回是否确有删除。"""
        if plugin_id in self._data["plugins"]:
            del self._data["plugins"][plugin_id]
            await self._store.async_save(self._data)
            return True
        return False

    async def async_set_plugin_enabled(self, plugin_id: str, enabled: bool) -> bool:
        """启用 / 禁用指定插件，返回是否成功（记录不存在返回 False）。"""
        rec = self._data["plugins"].get(plugin_id)
        if not isinstance(rec, dict):
            return False
        rec["enabled"] = bool(enabled)
        await self._store.async_save(self._data)
        return True
