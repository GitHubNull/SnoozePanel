"""SnoozePanel 设备级配置存储。

封装 homeassistant.helpers.storage.Store，按 device_id 分区读写配置记录。
存储结构：{"devices": {"<device_id>": {<设备级配置覆盖>}}}
Store 自动处理 .storage/ 原子写与 HA 重启存活。
"""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class SnoozeStorage:
    """设备级配置的读写封装。"""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"devices": {}}

    async def async_load(self) -> None:
        """从 .storage/ 加载（HA 启动时调用一次）。"""
        data = await self._store.async_load()
        if isinstance(data, dict) and isinstance(data.get("devices"), dict):
            self._data = {"devices": data["devices"]}
        else:
            self._data = {"devices": {}}

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
