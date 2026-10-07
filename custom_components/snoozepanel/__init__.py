"""SnoozePanel 后端集成：设备级配置持久化 + 侧边栏导航入口 + 前端产物自托管。

提供 WebSocket API 把每台设备（平板）的屏保配置覆盖落盘到 HA .storage/，
解决 HA 重启 / 浏览器清缓存 / 换 App 后配置丢失问题。
同时注册 panel_custom，在 HA 侧边栏生成「SnoozePanel」导航入口。
前端产物（snoozepanel.js）直接由集成目录经静态路径提供服务，并以
extra_module_url 随 HA 启动页早期加载（保证侧边栏自定义图标集在首渲前注册），
Lovelace 资源在 storage 模式下自动登记/迁移，安装后零手工配置。
纯本地读写，无任何遥测 / 上报 / 外发请求。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN
from .storage import SnoozeStorage
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)

# 前端产物自托管：集成目录内 frontend/snoozepanel.js（由 Release zip / 手动拷贝提供）
_FRONTEND_DIR = Path(__file__).parent / "frontend"
# 产物对外 URL 路径（同源；第三方插件目录通道仍走 /local/snoozepanel/plugins，不受影响）
_JS_URL_PATH = "/snoozepanel/snoozepanel.js"


def _read_manifest_version() -> str:
    """读取本集成 manifest.json 的 version，作为前端产物缓存破除串（单一版本源）。"""
    try:
        manifest = json.loads((Path(__file__).parent / "manifest.json").read_text(encoding="utf-8"))
        return str(manifest.get("version", "0"))
    except (OSError, ValueError):  # pragma: no cover - 保底，不应发生
        return "0"


# 模块导入期读取一次版本：HA 在 import executor 线程导入 custom integration 模块，
# 模块级同步 I/O 不在事件循环内执行。若在 async_setup（事件循环）中同步读文件，
# 会触发 homeassistant.util.loop 的 blocking call 告警（v0.11.2 生产日志已出现），
# 因此缓存为模块级常量。
_MANIFEST_VERSION = _read_manifest_version()


async def _async_ensure_lovelace_resource(hass: HomeAssistant, url: str) -> None:
    """在 storage 模式的 Lovelace 资源中登记/迁移本产物 URL（幂等）。

    旧版安装会把资源指向 /local/snoozepanel/snoozepanel.js，这里统一迁移到集成
    自托管路径；无资源记录时自动创建。YAML 模式或 lovelace 未就绪时跳过，
    用户仍可手动添加资源。登记失败只告警，绝不阻断集成加载。
    """
    try:
        data = hass.data.get("lovelace")
        resources = getattr(data, "resources", None)
        if resources is None or getattr(data, "resource_mode", None) != "storage":
            _LOGGER.info("Lovelace 为 YAML 模式或未就绪，跳过资源自动登记（可手动添加 %s）", url)
            return
        # storage 集合惰性加载：先触发 _async_ensure_loaded 再扫描
        await resources.async_get_info()
        for item in resources.async_items() or []:
            if "snoozepanel" not in str(item.get("url", "")):
                continue
            if item.get("url") != url:
                await resources.async_update_item(item["id"], {"res_type": "module", "url": url})
                _LOGGER.info("已迁移 Lovelace 资源 URL：%s", url)
            return
        await resources.async_create_item({"res_type": "module", "url": url})
        _LOGGER.info("已自动登记 Lovelace 资源：%s", url)
    except Exception as err:  # noqa: BLE001 - 资源登记失败不得阻断集成加载
        _LOGGER.warning("Lovelace 资源自动登记失败（可手动添加 %s）：%s", url, err)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """初始化存储并注册 WS 命令、前端产物服务与侧边栏面板（configuration.yaml 方式加载）。"""
    storage = SnoozeStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN] = storage
    async_register_websocket_commands(hass, storage)

    version = _MANIFEST_VERSION
    js_url = f"{_JS_URL_PATH}?v={version}"

    # 静态路径：从集成目录直接服务前端产物（不再依赖 config/www 拷贝）。
    # cache_headers=True 利用长缓存为常亮平板减负；缓存破除靠 URL 版本查询串，
    # 版本随 manifest 变化自动更新，发版不会复用旧串（区别于 /local 的旧陷阱）。
    await hass.http.async_register_static_paths(
        [StaticPathConfig(_JS_URL_PATH, str(_FRONTEND_DIR / "snoozepanel.js"), cache_headers=True)]
    )

    # 启动早期加载：把产物注册为 extra_module_url，随 HA 启动页 <head> 注入，
    # 早于侧边栏首次渲染 —— ha-icon 仅在首渲时解析自定义图标集（未注册则
    # sticky _legacy 永久空白，见 doc/ARCHITECTURE.md 决策 18），因此图标集
    # 必须先于侧边栏注册。module_url / Lovelace 资源两个旧通道都太晚。
    frontend.add_extra_js_url(hass, js_url)

    # Lovelace 资源自动登记/迁移（storage 模式）：保证卡片开箱即用
    await _async_ensure_lovelace_resource(hass, js_url)

    # 注册侧边栏导航入口：点击跳转至 SnoozePanel 配置页
    # sidebar_icon 使用前端产物注册的自定义图标集（snoozepanel:logo，见 src/runtime/iconset.ts）；
    # 产物经 extra_module_url 在侧边栏首渲前加载，图标可确定性显示；
    # 若目标 HA 仍未加载图标集，可回退为原生 mdi 图标，如 sidebar_icon="mdi:power-sleep"。
    # module_url 与 extra_js 同一 URL：浏览器按模块 URL 去重，只加载一次。
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="snooze-panel-sidebar",
        frontend_url_path="snoozepanel",
        sidebar_title="SnoozePanel",
        sidebar_icon="snoozepanel:logo",
        module_url=js_url,
        config={"mode": "config"},
    )

    _LOGGER.info(
        "SnoozePanel 后端已就绪：设备级配置持久化到 .storage/%s，侧边栏入口已注册，前端产物自托管于 %s",
        DOMAIN,
        js_url,
    )
    return True
