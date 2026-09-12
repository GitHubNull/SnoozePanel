"""SnoozePanel 常量定义。"""

DOMAIN = "snoozepanel"

# 设备级配置存储：HA .storage/snoozepanel
# v2：新增 plugins 分区（插件安装记录），见 storage.py
STORAGE_KEY = DOMAIN
STORAGE_VERSION = 2

# WebSocket 命令类型
WS_TYPE_GET_CONFIG = "snoozepanel/get_config"
WS_TYPE_SET_CONFIG = "snoozepanel/set_config"
WS_TYPE_LIST_DEVICES = "snoozepanel/list_devices"
WS_TYPE_DELETE_CONFIG = "snoozepanel/delete_config"
WS_TYPE_LIST_PLUGINS = "snoozepanel/list_plugins"
WS_TYPE_INSTALL_PLUGIN = "snoozepanel/install_plugin"
WS_TYPE_UNINSTALL_PLUGIN = "snoozepanel/uninstall_plugin"
WS_TYPE_SET_PLUGIN_ENABLED = "snoozepanel/set_plugin_enabled"

# ---- 插件安装限额（与前端 src/core/pluginLimits.ts 保持同口径；此处为强制层）----
# 单个 index.js 大小上限：512 KB
MAX_JS_BYTES = 512 * 1024
# plugin.json 大小上限：64 KB
MAX_MANIFEST_BYTES = 64 * 1024
# 单条安装记录总量上限（脚本 + 清单）：1 MB
MAX_RECORD_BYTES = 1024 * 1024
# 已安装插件数量上限
MAX_PLUGINS = 100
# 插件 id 规则：小写字母/数字开头，仅含小写字母/数字/连字符，长度 1-64
PLUGIN_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,63}$"
