import * as vscode from 'vscode';

/**
 * 薪资计算核心 —— 从原始 index.html 提取的纯逻辑
 * 包含 2024-2026 年中国法定节假日与调休
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

/** 从 VS Code 配置读取 */
export function getConfig(): SalaryConfig {
  const cfg = vscode.workspace.getConfiguration('salaryClock');
  return {
    monthlySalary: cfg.get<number>('monthlySalary', 20000),
    startTime: cfg.get<string>('startTime', '09:00'),
    endTime: cfg.get<string>('endTime', '18:00'),
    lunchDurationMin: cfg.get<number>('lunchDurationMin', 60),
    lunchStart: cfg.get<string>('lunchStart', '12:00'),
    mode: cfg.get<'work' | 'always'>('mode', 'work'),
    decimalPlaces: cfg.get<number>('decimalPlaces', 4),
  };
}

// ==================== 节假日数据 ====================

const HOLIDAYS: Record<string, { name: string }> = {
  // 2024
  '2024-01-01':{name:'元旦'},'2024-02-09':{name:'除夕'},'2024-02-10':{name:'春节'},'2024-02-11':{name:'春节'},'2024-02-12':{name:'春节'},'2024-02-13':{name:'春节'},'2024-02-14':{name:'春节'},'2024-02-15':{name:'春节'},'2024-02-16':{name:'春节'},'2024-02-17':{name:'春节'},'2024-04-04':{name:'清明'},'2024-04-05':{name:'清明'},'2024-04-06':{name:'清明'},'2024-05-01':{name:'劳动节'},'2024-05-02':{name:'劳动节'},'2024-05-03':{name:'劳动节'},'2024-05-04':{name:'劳动节'},'2024-05-05':{name:'劳动节'},'2024-06-10':{name:'端午'},'2024-09-15':{name:'中秋'},'2024-09-16':{name:'中秋'},'2024-09-17':{name:'中秋'},'2024-10-01':{name:'国庆'},'2024-10-02':{name:'国庆'},'2024-10-03':{name:'国庆'},'2024-10-04':{name:'国庆'},'2024-10-05':{name:'国庆'},'2024-10-06':{name:'国庆'},'2024-10-07':{name:'国庆'},
  // 2025
  '2025-01-01':{name:'元旦'},'2025-01-28':{name:'除夕'},'2025-01-29':{name:'春节'},'2025-01-30':{name:'春节'},'2025-01-31':{name:'春节'},'2025-02-01':{name:'春节'},'2025-02-02':{name:'春节'},'2025-02-03':{name:'春节'},'2025-02-04':{name:'春节'},'2025-04-04':{name:'清明'},'2025-04-05':{name:'清明'},'2025-04-06':{name:'清明'},'2025-05-01':{name:'劳动节'},'2025-05-02':{name:'劳动节'},'2025-05-03':{name:'劳动节'},'2025-05-04':{name:'劳动节'},'2025-05-05':{name:'劳动节'},'2025-05-31':{name:'端午'},'2025-06-01':{name:'端午'},'2025-06-02':{name:'端午'},'2025-10-01':{name:'国庆'},'2025-10-02':{name:'国庆'},'2025-10-03':{name:'国庆'},'2025-10-04':{name:'国庆'},'2025-10-05':{name:'国庆'},'2025-10-06':{name:'国庆'},'2025-10-07':{name:'国庆'},'2025-10-08':{name:'国庆'},
  // 2026
  '2026-01-01':{name:'元旦'},'2026-01-02':{name:'元旦'},'2026-01-03':{name:'元旦'},'2026-02-15':{name:'春节'},'2026-02-16':{name:'除夕'},'2026-02-17':{name:'春节'},'2026-02-18':{name:'春节'},'2026-02-19':{name:'春节'},'2026-02-20':{name:'春节'},'2026-02-21':{name:'春节'},'2026-02-22':{name:'春节'},'2026-02-23':{name:'春节'},'2026-04-04':{name:'清明'},'2026-04-05':{name:'清明'},'2026-04-06':{name:'清明'},'2026-05-01':{name:'劳动节'},'2026-05-02':{name:'劳动节'},'2026-05-03':{name:'劳动节'},'2026-05-04':{name:'劳动节'},'2026-05-05':{name:'劳动节'},'2026-06-19':{name:'端午'},'2026-06-20':{name:'端午'},'2026-06-21':{name:'端午'},'2026-09-25':{name:'中秋'},'2026-09-26':{name:'中秋'},'2026-09-27':{name:'中秋'},'2026-10-01':{name:'国庆'},'2026-10-02':{name:'国庆'},'2026-10-03':{name:'国庆'},'2026-10-04':{name:'国庆'},'2026-10-05':{name:'国庆'},'2026-10-06':{name:'国庆'},'2026-10-07':{name:'国庆'},
};

const WORKDAYS: Record<string, { name: string }> = {
  // 2024 调休上班
  '2024-02-04':{name:'春节调休'},'2024-02-18':{name:'春节调休'},'2024-04-07':{name:'清明调休'},'2024-04-28':{name:'劳动节调休'},'2024-05-11':{name:'劳动节调休'},'2024-09-14':{name:'中秋调休'},'2024-09-29':{name:'国庆调休'},'2024-10-12':{name:'国庆调休'},
  // 2025 调休上班
  '2025-01-26':{name:'春节调休'},'2025-02-08':{name:'春节调休'},'2025-04-27':{name:'劳动节调休'},'2025-09-28':{name:'国庆调休'},'2025-10-11':{name:'国庆调休'},
  // 2026 调休上班
  '2026-01-04':{name:'元旦调休'},'2026-02-14':{name:'春节调休'},'2026-02-28':{name:'春节调休'},'2026-05-09':{name:'劳动节调休'},'2026-09-20':{name:'国庆调休'},'2026-10-10':{name:'国庆调休'},
};

// ==================== 工具函数 ====================

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ==================== 工作日判断 ====================

/**
 * 判断某日是工作日、休息日还是半天
 * 返回 true=全天工作, 'half'=半天, false=休息
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

// ==================== 薪资计算 ====================

function getWorkHours(c: SalaryConfig): number {
  const start = parseTime(c.startTime);
  const end = parseTime(c.endTime);
  return (end - start - c.lunchDurationMin) / 60;
}

function calcMonthWorkDays(c: SalaryConfig, year: number, month: number): { days: number; hours: number } {
  const dim = new Date(year, month + 1, 0).getDate();
  if (c.mode === 'always') {
    return { days: dim, hours: dim * getWorkHours(c) };
  }
  // 上班才赚钱：只算工作日
  let totalDays = 0, totalHours = 0;
  for (let d = 1; d <= dim; d++) {
    const date = new Date(year, month, d);
    const wd = isWorkDay(date);
    if (wd === true) { totalDays++; totalHours += getWorkHours(c); }
    else if (wd === 'half') { totalDays += 0.5; totalHours += getWorkHours(c) * 0.5; }
  }
  return { days: totalDays, hours: totalHours };
}

export function calcEarned(c: SalaryConfig, now: Date): number {
  const { monthlySalary } = c;
  if (!monthlySalary || monthlySalary <= 0) return 0;

  const workHours = getWorkHours(c);
  if (workHours <= 0) return 0;

  const { hours: totalWorkHours } = calcMonthWorkDays(c, now.getFullYear(), now.getMonth());
  if (totalWorkHours <= 0) return 0;

  const hourlyRate = monthlySalary / totalWorkHours;

  // 随时都赚钱：月薪平摊到整月每一秒
  if (c.mode === 'always') {
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const totalSeconds = dim * 24 * 3600;
    const perSecond = monthlySalary / totalSeconds;
    const elapsed = (now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) / 1000;
    return perSecond * elapsed;
  }

  // 上班才赚钱：只在工作时段计算
  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  let lunchStartMin = 0, lunchEndMin = 0;
  if (c.lunchDurationMin > 0) {
    lunchStartMin = parseTime(c.lunchStart);
    lunchEndMin = lunchStartMin + c.lunchDurationMin;
  }

  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const currentTotalMin = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() + now.getMilliseconds() / 1000) / 60;

  let earned = 0;

  // 本月已过去的完整工作日
  for (let d = 1; d < today; d++) {
    const date = new Date(year, month, d);
    const wd = isWorkDay(date);
    if (wd === true) earned += hourlyRate * workHours;
    else if (wd === 'half') earned += hourlyRate * workHours * 0.5;
  }

  // 今天
  const todayDate = new Date(year, month, today);
  const todayWd = isWorkDay(todayDate);

  if (todayWd === true) {
    if (currentTotalMin >= workEnd) {
      earned += hourlyRate * workHours;
    } else if (currentTotalMin >= workStart) {
      let workedMin = currentTotalMin - workStart;
      if (lunchEndMin > lunchStartMin) {
        if (currentTotalMin > lunchEndMin) workedMin -= (lunchEndMin - lunchStartMin);
        else if (currentTotalMin > lunchStartMin) workedMin -= (currentTotalMin - lunchStartMin);
      }
      earned += hourlyRate * (workedMin / 60);
    }
  } else if (todayWd === 'half') {
    if (currentTotalMin >= workEnd) {
      earned += hourlyRate * workHours * 0.5;
    } else if (currentTotalMin >= workStart) {
      let workedMin = currentTotalMin - workStart;
      if (lunchEndMin > lunchStartMin) {
        if (currentTotalMin > lunchEndMin) workedMin -= (lunchEndMin - lunchStartMin);
        else if (currentTotalMin > lunchStartMin) workedMin -= (currentTotalMin - lunchStartMin);
      }
      earned += hourlyRate * (workedMin / 60) * 0.5;
    }
  }

  return earned;
}

export function isWorkingTime(c: SalaryConfig, now: Date): boolean {
  if (c.mode === 'always') return true;
  const wd = isWorkDay(now);
  if (wd === false) return false;
  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return currentMin >= workStart && currentMin < workEnd;
}

export function formatMoney(amount: number, decimalPlaces: number): string {
  return `¥ ${amount.toFixed(decimalPlaces)}`;
}
