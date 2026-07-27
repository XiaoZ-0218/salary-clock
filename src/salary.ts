import * as vscode from 'vscode';
import {
  SalaryConfig,
  DayMarkEntry,
  mergeDayMarks,
  parseTime,
  WORKDAYS,
} from './salary-core';

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
  let monthlySalary = cfg.get<number>('1salary', 20000);
  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) monthlySalary = 20000;

  // lunchDurationMin: clamp 到 0–600 分钟
  let lunchDurationMin = cfg.get<number>('4lunchDuration', 120);
  if (!Number.isFinite(lunchDurationMin)) lunchDurationMin = 60;
  lunchDurationMin = Math.min(600, Math.max(0, lunchDurationMin));

  // decimalPlaces: clamp 到 0–6，取整
  let decimalPlaces = cfg.get<number>('7decimal', 4);
  if (!Number.isFinite(decimalPlaces)) decimalPlaces = 4;
  decimalPlaces = Math.min(6, Math.max(0, Math.round(decimalPlaces)));

  const mode = cfg.get<'work' | 'always'>('6mode', 'work') === 'always' ? 'always' : 'work';

  // 节假日：内置固定（不暴露用户配置）。
  // 调休：内置 + 用户配置合并；可通过 workdayAdjustment 总开关一键关闭。
  const userWorkdays = cfg.get<DayMarkEntry[]>('Bworkdays', []);
  const workdays = mergeDayMarks(WORKDAYS, userWorkdays);
  const workdayAdjustment = cfg.get<boolean>('Badjustment', true);

  return {
    monthlySalary,
    startTime: validTime(cfg.get<string>('2workStart', '10:30'), '10:30'),
    endTime: validTime(cfg.get<string>('5workEnd', '18:30'), '18:30'),
    lunchDurationMin,
    lunchStart: validTime(cfg.get<string>('3lunchStart', '12:00'), '12:00'),
    mode,
    decimalPlaces,
    workdays,
    workdayAdjustment,
  };
}
