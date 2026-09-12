/**
 * 设备级配置保存（后端持久化）。
 *
 * 把当前编辑草稿整体存为本设备的后端覆盖配置（custom component + `.storage/`），
 * 并以 Toast 反馈成功 / 失败 / 异常；后端不可用时给出明确提示而非静默失败。
 * 具体读写封装见 `src/core/store.ts`。
 */
import { ref, type Ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import type { SnoozeConfig } from '@/core/types';
import type { HassLike } from '@/core/hass';
import { saveDeviceConfig } from '@/core/store';

/** 保存所需的最小 props 面 */
interface DeviceSaveProps {
  hass: HassLike | null;
}

/**
 * 创建设备级保存动作与反馈状态。
 * @param props 组件 props（至少含 hass）
 * @param deviceId 当前设备 id
 * @param draft 当前编辑草稿
 */
export function useDeviceSave(
  props: DeviceSaveProps,
  deviceId: string,
  draft: SnoozeConfig,
): {
  deviceSaving: Ref<boolean>;
  deviceSaved: Ref<string>;
  onSaveDevice: () => Promise<void>;
} {
  const toast = useToast();
  const deviceSaving = ref(false);
  const deviceSaved = ref('');

  /** 把当前草稿整体存为本设备的后端覆盖配置（含 Toast 反馈） */
  async function onSaveDevice(): Promise<void> {
    if (!props.hass) {
      deviceSaved.value = '后端不可用';
      toast.add({
        severity: 'warn',
        summary: '后端不可用',
        detail: '当前环境未连接 Home Assistant，无法保存设备级配置。',
        life: 4000,
      });
      return;
    }
    deviceSaving.value = true;
    deviceSaved.value = '';
    try {
      const ok = await saveDeviceConfig(props.hass, deviceId, JSON.parse(JSON.stringify(draft)) as SnoozeConfig);
      deviceSaved.value = ok ? '已保存到后端' : '保存失败（后端不可用）';
      if (ok) {
        toast.add({
          severity: 'success',
          summary: '保存成功',
          detail: `配置已保存为本设备（${deviceId}）的独立覆盖。`,
          life: 3000,
        });
        setTimeout(() => { deviceSaved.value = ''; }, 3000);
      } else {
        toast.add({
          severity: 'error',
          summary: '保存失败',
          detail: '后端未接受本次写入，请检查连接后重试。',
          life: 5000,
        });
      }
    } catch (err) {
      deviceSaved.value = '保存异常';
      toast.add({
        severity: 'error',
        summary: '保存异常',
        detail: err instanceof Error ? err.message : String(err),
        life: 5000,
      });
    } finally {
      deviceSaving.value = false;
    }
  }

  return { deviceSaving, deviceSaved, onSaveDevice };
}
