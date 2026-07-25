import * as vscode from 'vscode';
import { SalaryConfig, parseTime } from './salary-core';

/**
 * VS Code 侧配置读取层。
 * 纯计算逻辑全部迁移至 `./salary-core`（零 vscode 依赖，便于测试）。
 * 此处 re-export 同名 API，保持既有 import 路径（extension.ts / 测试）不破坏。
 */

export * from './salary-core';

/** 时间字段校验失败时回退到默认值 */
function validTime(t: unknown, def: string): string {
  return typeof t === 'string' && parseTime(t) !== null ? t : def;
}

/** 从 VS Code 配置读取，并对每个字段做 clamp / 类型校验兜底 */
export function getConfig(): SalaryConfig {
  const cfg = vscode.workspace.getConfiguration('salaryClock');

  // monthlySalary: 必须是有限数且非负，否则回退默认 20000
  let monthlySalary = cfg.get<number>('monthlySalary', 20000);
  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) monthlySalary = 20000;

  // lunchDurationMin: clamp 到 0–600 分钟
  let lunchDurationMin = cfg.get<number>('lunchDurationMin', 60);
  if (!Number.isFinite(lunchDurationMin)) lunchDurationMin = 60;
  lunchDurationMin = Math.min(600, Math.max(0, lunchDurationMin));

  // decimalPlaces: clamp 到 0–6，取整
  let decimalPlaces = cfg.get<number>('decimalPlaces', 4);
  if (!Number.isFinite(decimalPlaces)) decimalPlaces = 4;
  decimalPlaces = Math.min(6, Math.max(0, Math.round(decimalPlaces)));

  const mode = cfg.get<'work' | 'always'>('mode', 'work') === 'always' ? 'always' : 'work';

  return {
    monthlySalary,
    startTime: validTime(cfg.get<string>('startTime', '09:00'), '09:00'),
    endTime: validTime(cfg.get<string>('endTime', '18:00'), '18:00'),
    lunchDurationMin,
    lunchStart: validTime(cfg.get<string>('lunchStart', '12:00'), '12:00'),
    mode,
    decimalPlaces,
  };
}
