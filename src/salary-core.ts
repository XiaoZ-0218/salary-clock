/**
 * 薪资计算核心 —— 从原始 index.html 提取的纯逻辑
 * 包含 2026 年中国法定节假日与调休
 *
 * 本文件**零 vscode 依赖**，可被扩展主进程与单元测试直接复用。
 *
 * 关于「半天（half）」：当前 HOLIDAYS/WORKDAYS 数据里没有任何一天会命中
 * `isWorkDay` 返回 'half' 的分支，因此 `=== 'half'` 目前是死分支。为保留
 * 未来「半天班」扩展余地（例如某些公司周五下午调休），此处**不删除** half
 * 逻辑，统一按 0.5 权重（半天工作、半天工时）处理。调用方遇到 'half' 均按
 * 0.5 处理。
 */

import holidaysData from './data/holidays.json';
import workdaysData from './data/workdays.json';

export interface SalaryConfig {
  monthlySalary: number;
  startTime: string;      // "HH:mm"
  endTime: string;        // "HH:mm"
  lunchDurationMin: number;
  lunchStart: string;     // "HH:mm"
  mode: 'work' | 'always';
  decimalPlaces: number;
  /** 用户配置 + 内置合并后的调休表（可选：未传时 isWorkDay 用内置常量） */
  workdays?: Record<string, DayMark>;
  /** 是否启用调休上班日（默认 true；false 时调休按休息日处理） */
  workdayAdjustment?: boolean;
}

/** 单日标记：{ name } */
export interface DayMark {
  name: string;
}

/** 用户在 settings.json 配置的节假日/调休条目（带 date 字段） */
export interface DayMarkEntry {
  date: string;   // "YYYY-MM-DD"
  name: string;
}

/** isWorkDay 的返回：全天工作(true) | 半天('half') | 休息(false) */
export type WorkDayResult = boolean | 'half';

/** 校验日期字符串格式 YYYY-MM-DD（不依赖 Date 构造，避免时区歧义） */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 合并内置数据与用户在 settings.json 中配置的条目。
 * - 同一天 key（YYYY-MM-DD）以用户配置为准（覆盖内置）。
 * - 非法条目（缺 date / 非字符串 name / 日期格式错）静默跳过，避免坏数据击穿整张表。
 */
export function mergeDayMarks(
  builtin: Record<string, DayMark>,
  userEntries: ReadonlyArray<DayMarkEntry> | undefined,
): Record<string, DayMark> {
  const merged: Record<string, DayMark> = { ...builtin };
  if (!Array.isArray(userEntries)) return merged;
  for (const entry of userEntries) {
    if (
      entry && typeof entry === 'object' &&
      typeof entry.date === 'string' && DATE_RE.test(entry.date) &&
      typeof entry.name === 'string' && entry.name.trim().length > 0
    ) {
      merged[entry.date] = { name: entry.name.trim() };
    }
  }
  return merged;
}

// ==================== 节假日数据（按年分组 JSON → 展平） ====================

type YearGroupedData = Record<string, Record<string, DayMark>>;

/** 把 { "2026": { "2026-01-01": {...} }, ... } 展平为 { "2026-01-01": {...}, ... } */
function flatten(data: YearGroupedData): Record<string, DayMark> {
  return Object.assign({}, ...Object.values(data)) as Record<string, DayMark>;
}

export const HOLIDAYS: Record<string, DayMark> = flatten(holidaysData as YearGroupedData);
export const WORKDAYS: Record<string, DayMark> = flatten(workdaysData as YearGroupedData);

/** 节假日数据覆盖的年份集合（升序），用于「数据过期」判断 */
export const COVERED_YEARS: number[] = Object.keys(holidaysData as YearGroupedData)
  .map((y) => Number(y))
  .filter((y) => Number.isFinite(y))
  .sort((a, b) => a - b);

/** 该年份是否有内置节假日数据；无则 isWorkDay 会退化为「仅按周末」近似 */
export function hasHolidayData(year: number): boolean {
  return COVERED_YEARS.includes(year);
}

/**
 * 返回节假日/调休数据覆盖的年份区间 [最小年, 最大年]。
 * 当前系统时间超出该区间时，节假日判断会退化为「仅按周末」，需提示用户更新数据。
 */
export function getCoveredYears(): [number, number] {
  const years = [...Object.keys(HOLIDAYS), ...Object.keys(WORKDAYS)]
    .map((d) => parseInt(d.slice(0, 4), 10))
    .filter((y) => Number.isFinite(y));
  if (years.length === 0) return [0, 0];
  return [Math.min(...years), Math.max(...years)];
}

// ==================== 工具函数 ====================

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 严格解析 "HH:mm"，合法返回自 00:00 起的分钟数，非法返回 null。
 * 只接受 00:00 - 23:59，杜绝 "9:00"/"25:61"/"abc" 等造成 NaN 传播。
 */
export function parseTime(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ==================== 工作日判断 ====================

/**
 * 判断某日是工作日、休息日还是半天
 * 返回 true=全天工作, 'half'=半天, false=休息
 * （'half' 目前为可扩展保留分支，见文件顶部说明）
 *
 * 参数：
 * - holidays：法定节假日表（内置固定，传 HOLIDAYS）
 * - workdays：调休上班表（用户配置 + 内置合并）
 * - workdayAdjustment：是否启用调休（默认 true；false 时调休按休息日处理）
 */
export function isWorkDay(
  date: Date,
  holidays: Record<string, DayMark> = HOLIDAYS,
  workdays: Record<string, DayMark> = WORKDAYS,
  workdayAdjustment: boolean = true,
): boolean | 'half' {
  const ds = formatDate(date);
  const dayOfWeek = date.getDay();

  // 法定节假日 → 休息
  if (holidays[ds]) return false;
  // 调休上班（仅当启用调休开关时）
  if (workdayAdjustment && workdays[ds]) return true;
  // 周末 → 休息
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  // 普通工作日
  return true;
}

/** 将 isWorkDay 的结果换算成当天工作权重：true→1, 'half'→0.5, false→0 */
function workDayWeight(wd: boolean | 'half'): number {
  if (wd === true) return 1;
  if (wd === 'half') return 0.5;
  return 0;
}

// ==================== 薪资计算 ====================

/** 每个完整工作日的工时（小时）。时间非法时返回 NaN，由上层守卫兜底。 */
export function getWorkHours(c: SalaryConfig): number {
  const start = parseTime(c.startTime);
  const end = parseTime(c.endTime);
  if (start === null || end === null) return NaN;
  const lunch = Number.isFinite(c.lunchDurationMin) ? c.lunchDurationMin : 0;
  return (end - start - lunch) / 60;
}

export function calcMonthWorkDays(
  c: SalaryConfig,
  year: number,
  month: number,
  isWorkDayFn: (d: Date) => WorkDayResult = (d) => isWorkDay(d, HOLIDAYS, c.workdays, c.workdayAdjustment ?? true),
): { days: number; hours: number } {
  const dim = new Date(year, month + 1, 0).getDate();
  // 上班才赚钱：只算工作日（always 模式下只是薪资计算不同，工时统计不变）
  const workHours = getWorkHours(c);
  const perDayHours = Number.isFinite(workHours) ? workHours : 0;
  let totalDays = 0, totalHours = 0;
  for (let d = 1; d <= dim; d++) {
    const w = workDayWeight(isWorkDayFn(new Date(year, month, d)));
    if (w > 0) { totalDays += w; totalHours += perDayHours * w; }
  }
  return { days: totalDays, hours: totalHours };
}

/**
 * 截至 nowMin，今天已计薪的分钟数（扣除午休）。
 */
function workedMinutesSoFar(
  nowMin: number,
  workStart: number,
  workEnd: number,
  lunchStart: number,
  lunchEnd: number,
): number {
  const clamped = Math.min(nowMin, workEnd);
  if (clamped <= workStart) return 0;
  let worked = clamped - workStart;
  if (lunchEnd > lunchStart) {
    const overlapStart = Math.max(lunchStart, workStart);
    const overlapEnd = Math.min(lunchEnd, clamped);
    if (overlapEnd > overlapStart) worked -= overlapEnd - overlapStart;
  }
  return Math.max(0, worked);
}

export function calcEarned(
  c: SalaryConfig,
  now: Date,
  isWorkDayFn: (d: Date) => WorkDayResult = (d) => isWorkDay(d, HOLIDAYS, c.workdays, c.workdayAdjustment ?? true),
): number {
  const monthlySalary = c.monthlySalary;
  if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) return 0;

  // always 模式：月薪按整月时间线性平摊，不依赖 startTime/endTime/lunch。
  // 先行返回，避免被下方工作时段守卫误伤（历史 bug：always 曾因 workHours<=0 返回 0）。
  if (c.mode === 'always') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const span = monthEnd - monthStart;
    if (span <= 0) return 0;
    return (monthlySalary * (now.getTime() - monthStart)) / span;
  }

  const workHours = getWorkHours(c);
  if (!Number.isFinite(workHours) || workHours <= 0) return 0;

  const { hours: totalWorkHours } = calcMonthWorkDays(c, now.getFullYear(), now.getMonth(), isWorkDayFn);
  if (!Number.isFinite(totalWorkHours) || totalWorkHours <= 0) return 0;

  const hourlyRate = monthlySalary / totalWorkHours;

  // 工作时段边界（parseTime 已在 getConfig 校验，这里再兜底一次）
  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  if (workStart === null || workEnd === null) return 0;

  let lunchStartMin = 0, lunchEndMin = 0;
  if (c.lunchDurationMin > 0) {
    const ls = parseTime(c.lunchStart);
    if (ls !== null) {
      lunchStartMin = ls;
      lunchEndMin = ls + c.lunchDurationMin;
    }
  }

  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const currentTotalMin = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() + now.getMilliseconds() / 1000) / 60;

  let earned = 0;

  // 本月已过去的完整工作日
  for (let d = 1; d < today; d++) {
    const w = workDayWeight(isWorkDayFn(new Date(year, month, d)));
    if (w > 0) earned += hourlyRate * workHours * w;
  }

  // 今天：按已计薪分钟数累计（workedMinutesSoFar 与 isWorkingMinute 共用边界，午休判断一致）
  const todayWeight = workDayWeight(isWorkDayFn(new Date(year, month, today)));
  if (todayWeight > 0) {
    const worked = workedMinutesSoFar(currentTotalMin, workStart, workEnd, lunchStartMin, lunchEndMin);
    earned += hourlyRate * (worked / 60) * todayWeight;
  }

  return earned;
}

/**
 * 当前是否处于工作时段（状态栏图标/文案用）。
 * 注意：**不扣午休**——午休期间仍视为「工作时段」（图标仍显示赚钱中）。
 * 真正「是否在计薪分钟」由 calcEarned/workedMinutesSoFar 负责，两者关注点不同。
 */
export function isWorkingTime(c: SalaryConfig, now: Date): boolean {
  if (c.mode === 'always') return true;
  if (isWorkDay(now, HOLIDAYS, c.workdays, c.workdayAdjustment ?? true) === false) return false;

  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  if (workStart === null || workEnd === null) return false;

  const currentMin = now.getHours() * 60 + now.getMinutes();
  return currentMin >= workStart && currentMin < workEnd;
}

export function formatMoney(amount: number, decimalPlaces: number): string {
  if (!Number.isFinite(amount)) return '¥ —';
  const dp = Number.isFinite(decimalPlaces) ? Math.min(6, Math.max(0, Math.floor(decimalPlaces))) : 0;
  return `¥ ${amount.toFixed(dp)}`;
}

/**
 * 计算今日工作进度百分比（0-1）。
 * 基于配置的上下班时间和午休时间计算。
 * 非工作日返回 0，上班前返回 0，下班后返回 1。
 */
export function calcWorkProgress(c: SalaryConfig, now: Date): number {
  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  if (workStart === null || workEnd === null) return 0;

  const lunch = Number.isFinite(c.lunchDurationMin) ? c.lunchDurationMin : 0;
  const totalWorkMinutes = workEnd - workStart - lunch;
  if (totalWorkMinutes <= 0) return 0;

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() + now.getMilliseconds() / 1000) / 60;

  // 上班前
  if (nowMinutes <= workStart) return 0;
  // 下班后
  if (nowMinutes >= workEnd) return 1;

  let workedMinutes = nowMinutes - workStart;

  // 扣除午休时间
  if (c.lunchDurationMin > 0) {
    const lunchStart = parseTime(c.lunchStart);
    if (lunchStart !== null) {
      const lunchEnd = lunchStart + c.lunchDurationMin;
      // 如果当前时间在午休期间，进度停在午休开始
      if (nowMinutes >= lunchStart && nowMinutes < lunchEnd) {
        workedMinutes = lunchStart - workStart;
      } else if (nowMinutes >= lunchEnd) {
        workedMinutes = nowMinutes - c.lunchDurationMin - workStart;
      }
    }
  }

  return Math.min(1, Math.max(0, workedMinutes / totalWorkMinutes));
}

/** 生成分辨率为 10 的进度条字符串 */
export function progressBar(progress: number, filled = '▰', empty = '▱'): string {
  const filledCount = Math.round(progress * 10);
  return filled.repeat(filledCount) + empty.repeat(10 - filledCount);
}

/**
 * 计算截至 now，本月已过的工作小时数（基于配置的上下班时间和午休）。
 * 与 mode 无关，始终按工作日 + 工时配置计算。
 */
export function calcMonthWorkHours(
  c: SalaryConfig,
  now: Date,
  isWorkDayFn: (d: Date) => WorkDayResult = (d) => isWorkDay(d, HOLIDAYS, c.workdays, c.workdayAdjustment ?? true),
): { worked: number; total: number } {
  const workHours = getWorkHours(c);
  if (!Number.isFinite(workHours) || workHours <= 0) return { worked: 0, total: 0 };

  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  if (workStart === null || workEnd === null) return { worked: 0, total: 0 };

  let lunchStartMin = 0, lunchEndMin = 0;
  if (c.lunchDurationMin > 0) {
    const ls = parseTime(c.lunchStart);
    if (ls !== null) {
      lunchStartMin = ls;
      lunchEndMin = ls + c.lunchDurationMin;
    }
  }

  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const dim = new Date(year, month + 1, 0).getDate();
  const currentTotalMin = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() + now.getMilliseconds() / 1000) / 60;

  let workedHours = 0;
  let totalHours = 0;

  // 遍历整月：分母 = 本月所有工作日总工时，分子 = 截至今天已过工时
  for (let d = 1; d <= dim; d++) {
    const w = workDayWeight(isWorkDayFn(new Date(year, month, d)));
    if (w <= 0) continue;
    totalHours += workHours * w;
    if (d < today) {
      workedHours += workHours * w;
    }
  }

  // 今天：分子按已过分钟数算
  const todayWeight = workDayWeight(isWorkDayFn(new Date(year, month, today)));
  if (todayWeight > 0) {
    workedHours += workedMinutesSoFar(currentTotalMin, workStart, workEnd, lunchStartMin, lunchEndMin) / 60 * todayWeight;
  }

  return { worked: workedHours, total: totalHours };
}

/**
 * 计算本周工作小时数（周一至周日所有工作日）。
 * 与 mode 无关，始终按工作日 + 工时配置计算。
 */
export function calcWeekWorkHours(
  c: SalaryConfig,
  now: Date,
  isWorkDayFn: (d: Date) => WorkDayResult = (d) => isWorkDay(d, HOLIDAYS, c.workdays, c.workdayAdjustment ?? true),
): { worked: number; total: number } {
  const workHours = getWorkHours(c);
  if (!Number.isFinite(workHours) || workHours <= 0) return { worked: 0, total: 0 };

  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  if (workStart === null || workEnd === null) return { worked: 0, total: 0 };

  let lunchStartMin = 0, lunchEndMin = 0;
  if (c.lunchDurationMin > 0) {
    const ls = parseTime(c.lunchStart);
    if (ls !== null) {
      lunchStartMin = ls;
      lunchEndMin = ls + c.lunchDurationMin;
    }
  }

  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  // 周日 = 周一 + 6 天
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const currentTotalMin = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() + now.getMilliseconds() / 1000) / 60;

  let workedHours = 0;
  let totalHours = 0;
  const current = new Date(monday);

  // 遍历整周（周一到周日）：分母 = 全周工作日总工时
  while (current <= sunday) {
    const wd = isWorkDayFn(current);
    if (wd !== false) {
      const w = workDayWeight(wd);
      totalHours += workHours * w;
      if (current < today) {
        workedHours += workHours * w;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  // 今天（扣除午休）
  const todayWeight = workDayWeight(isWorkDayFn(today));
  if (todayWeight > 0) {
    workedHours += workedMinutesSoFar(currentTotalMin, workStart, workEnd, lunchStartMin, lunchEndMin) / 60 * todayWeight;
  }

  return { worked: workedHours, total: totalHours };
}
