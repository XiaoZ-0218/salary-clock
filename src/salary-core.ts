/**
 * 薪资计算核心 —— 从原始 index.html 提取的纯逻辑
 * 包含 2024-2026 年中国法定节假日与调休
 *
 * 本文件**零 vscode 依赖**，可被扩展主进程与单元测试直接复用。
 *
 * 关于「半天（half）」：当前 HOLIDAYS/WORKDAYS 数据里没有任何一天会命中
 * `isWorkDay` 返回 'half' 的分支，因此 `=== 'half'` 目前是死分支。为保留
 * 未来「半天班」扩展余地（例如某些公司周五下午调休），此处**不删除** half
 * 逻辑，统一按 0.5 权重（半天工作、半天工时）处理。调用方遇到 'half' 均按
 * 0.5 处理。
 */

export interface SalaryConfig {
  monthlySalary: number;
  startTime: string;      // "HH:mm"
  endTime: string;        // "HH:mm"
  lunchDurationMin: number;
  lunchStart: string;     // "HH:mm"
  mode: 'work' | 'always';
  decimalPlaces: number;
}

// ==================== 节假日数据 ====================

export const HOLIDAYS: Record<string, { name: string }> = {
  // 2024
  '2024-01-01':{name:'元旦'},'2024-02-09':{name:'除夕'},'2024-02-10':{name:'春节'},'2024-02-11':{name:'春节'},'2024-02-12':{name:'春节'},'2024-02-13':{name:'春节'},'2024-02-14':{name:'春节'},'2024-02-15':{name:'春节'},'2024-02-16':{name:'春节'},'2024-02-17':{name:'春节'},'2024-04-04':{name:'清明'},'2024-04-05':{name:'清明'},'2024-04-06':{name:'清明'},'2024-05-01':{name:'劳动节'},'2024-05-02':{name:'劳动节'},'2024-05-03':{name:'劳动节'},'2024-05-04':{name:'劳动节'},'2024-05-05':{name:'劳动节'},'2024-06-10':{name:'端午'},'2024-09-15':{name:'中秋'},'2024-09-16':{name:'中秋'},'2024-09-17':{name:'中秋'},'2024-10-01':{name:'国庆'},'2024-10-02':{name:'国庆'},'2024-10-03':{name:'国庆'},'2024-10-04':{name:'国庆'},'2024-10-05':{name:'国庆'},'2024-10-06':{name:'国庆'},'2024-10-07':{name:'国庆'},
  // 2025
  '2025-01-01':{name:'元旦'},'2025-01-28':{name:'除夕'},'2025-01-29':{name:'春节'},'2025-01-30':{name:'春节'},'2025-01-31':{name:'春节'},'2025-02-01':{name:'春节'},'2025-02-02':{name:'春节'},'2025-02-03':{name:'春节'},'2025-02-04':{name:'春节'},'2025-04-04':{name:'清明'},'2025-04-05':{name:'清明'},'2025-04-06':{name:'清明'},'2025-05-01':{name:'劳动节'},'2025-05-02':{name:'劳动节'},'2025-05-03':{name:'劳动节'},'2025-05-04':{name:'劳动节'},'2025-05-05':{name:'劳动节'},'2025-05-31':{name:'端午'},'2025-06-01':{name:'端午'},'2025-06-02':{name:'端午'},'2025-10-01':{name:'国庆'},'2025-10-02':{name:'国庆'},'2025-10-03':{name:'国庆'},'2025-10-04':{name:'国庆'},'2025-10-05':{name:'国庆'},'2025-10-06':{name:'国庆'},'2025-10-07':{name:'国庆'},'2025-10-08':{name:'国庆'},
  // 2026
  '2026-01-01':{name:'元旦'},'2026-01-02':{name:'元旦'},'2026-01-03':{name:'元旦'},'2026-02-15':{name:'春节'},'2026-02-16':{name:'除夕'},'2026-02-17':{name:'春节'},'2026-02-18':{name:'春节'},'2026-02-19':{name:'春节'},'2026-02-20':{name:'春节'},'2026-02-21':{name:'春节'},'2026-02-22':{name:'春节'},'2026-02-23':{name:'春节'},'2026-04-04':{name:'清明'},'2026-04-05':{name:'清明'},'2026-04-06':{name:'清明'},'2026-05-01':{name:'劳动节'},'2026-05-02':{name:'劳动节'},'2026-05-03':{name:'劳动节'},'2026-05-04':{name:'劳动节'},'2026-05-05':{name:'劳动节'},'2026-06-19':{name:'端午'},'2026-06-20':{name:'端午'},'2026-06-21':{name:'端午'},'2026-09-25':{name:'中秋'},'2026-09-26':{name:'中秋'},'2026-09-27':{name:'中秋'},'2026-10-01':{name:'国庆'},'2026-10-02':{name:'国庆'},'2026-10-03':{name:'国庆'},'2026-10-04':{name:'国庆'},'2026-10-05':{name:'国庆'},'2026-10-06':{name:'国庆'},'2026-10-07':{name:'国庆'},
};

export const WORKDAYS: Record<string, { name: string }> = {
  // 2024 调休上班
  '2024-02-04':{name:'春节调休'},'2024-02-18':{name:'春节调休'},'2024-04-07':{name:'清明调休'},'2024-04-28':{name:'劳动节调休'},'2024-05-11':{name:'劳动节调休'},'2024-09-14':{name:'中秋调休'},'2024-09-29':{name:'国庆调休'},'2024-10-12':{name:'国庆调休'},
  // 2025 调休上班
  '2025-01-26':{name:'春节调休'},'2025-02-08':{name:'春节调休'},'2025-04-27':{name:'劳动节调休'},'2025-09-28':{name:'国庆调休'},'2025-10-11':{name:'国庆调休'},
  // 2026 调休上班
  '2026-01-04':{name:'元旦调休'},'2026-02-14':{name:'春节调休'},'2026-02-28':{name:'春节调休'},'2026-05-09':{name:'劳动节调休'},'2026-09-20':{name:'国庆调休'},'2026-10-10':{name:'国庆调休'},
};

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
export function parseTime(t: string): number | null {
  if (typeof t !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ==================== 工作日判断 ====================

/**
 * 判断某日是工作日、休息日还是半天
 * 返回 true=全天工作, 'half'=半天, false=休息
 * （'half' 目前为可扩展保留分支，见文件顶部说明）
 */
export function isWorkDay(date: Date): boolean | 'half' {
  const ds = formatDate(date);
  const dayOfWeek = date.getDay();

  // 法定节假日 → 休息
  if (HOLIDAYS[ds]) return false;
  // 调休上班 → 工作
  if (WORKDAYS[ds]) return true;
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

export function calcMonthWorkDays(c: SalaryConfig, year: number, month: number): { days: number; hours: number } {
  const dim = new Date(year, month + 1, 0).getDate();
  if (c.mode === 'always') {
    // always 模式：整月每一天、每一秒都计薪，与工时/工作日无关
    return { days: dim, hours: dim * 24 };
  }
  // 上班才赚钱：只算工作日
  const workHours = getWorkHours(c);
  const perDayHours = Number.isFinite(workHours) ? workHours : 0;
  let totalDays = 0, totalHours = 0;
  for (let d = 1; d <= dim; d++) {
    const w = workDayWeight(isWorkDay(new Date(year, month, d)));
    if (w > 0) { totalDays += w; totalHours += perDayHours * w; }
  }
  return { days: totalDays, hours: totalHours };
}

/**
 * 单一来源：给定分钟数是否处于「正在计薪」的工作分钟。
 * 用于 isWorkingTime 与状态展示，保证午休判断与 calcEarned 完全一致。
 */
export function isWorkingMinute(
  nowMin: number,
  workStart: number,
  workEnd: number,
  lunchStart: number,
  lunchEnd: number,
): boolean {
  if (nowMin < workStart || nowMin >= workEnd) return false;
  if (lunchEnd > lunchStart && nowMin >= lunchStart && nowMin < lunchEnd) return false;
  return true;
}

/**
 * 截至 nowMin，今天已计薪的分钟数（扣除午休）。
 * 与 isWorkingMinute 共用同一套 work/lunch 边界，两者判断天然一致。
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

export function calcEarned(c: SalaryConfig, now: Date): number {
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

  const { hours: totalWorkHours } = calcMonthWorkDays(c, now.getFullYear(), now.getMonth());
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
    const w = workDayWeight(isWorkDay(new Date(year, month, d)));
    if (w > 0) earned += hourlyRate * workHours * w;
  }

  // 今天：按已计薪分钟数累计（workedMinutesSoFar 与 isWorkingMinute 共用边界，午休判断一致）
  const todayWeight = workDayWeight(isWorkDay(new Date(year, month, today)));
  if (todayWeight > 0) {
    const worked = workedMinutesSoFar(currentTotalMin, workStart, workEnd, lunchStartMin, lunchEndMin);
    earned += hourlyRate * (worked / 60) * todayWeight;
  }

  return earned;
}

export function isWorkingTime(c: SalaryConfig, now: Date): boolean {
  if (c.mode === 'always') return true;
  if (isWorkDay(now) === false) return false;

  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  if (workStart === null || workEnd === null) return false;

  let lunchStartMin = 0, lunchEndMin = 0;
  if (c.lunchDurationMin > 0) {
    const ls = parseTime(c.lunchStart);
    if (ls !== null) {
      lunchStartMin = ls;
      lunchEndMin = ls + c.lunchDurationMin;
    }
  }

  const currentMin = now.getHours() * 60 + now.getMinutes();
  return isWorkingMinute(currentMin, workStart, workEnd, lunchStartMin, lunchEndMin);
}

export function formatMoney(amount: number, decimalPlaces: number): string {
  if (!Number.isFinite(amount)) return '¥ —';
  const dp = Number.isFinite(decimalPlaces) ? Math.min(6, Math.max(0, Math.floor(decimalPlaces))) : 4;
  return `¥ ${amount.toFixed(dp)}`;
}
