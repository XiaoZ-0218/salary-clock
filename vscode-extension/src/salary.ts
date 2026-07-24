import * as vscode from 'vscode';

/**
 * 薪资计算核心 —— 从原始 index.html 提取的纯逻辑
 * 零依赖，只依赖 VS Code 配置 API
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

/** "HH:mm" → 分钟数 */
function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 每日工作小时数（扣除午休） */
function getWorkHours(c: SalaryConfig): number {
  const start = parseTime(c.startTime);
  const end = parseTime(c.endTime);
  return (end - start - c.lunchDurationMin) / 60;
}

/** 计算当月工作日天数与总工时 */
function calcMonthWorkDays(c: SalaryConfig, year: number, month: number): { days: number; hours: number } {
  const dim = new Date(year, month + 1, 0).getDate();
  // 随时都赚钱：全月每一天
  if (c.mode === 'always') {
    return { days: dim, hours: dim * getWorkHours(c) };
  }
  // 上班才赚钱：默认全部是工作日（简化版，不含节假日判断）
  return { days: dim, hours: dim * getWorkHours(c) };
}

/**
 * 计算在指定时刻已赚到的工资
 */
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
  let lunchStartMin = 0;
  let lunchEndMin = 0;
  if (c.lunchDurationMin > 0) {
    lunchStartMin = parseTime(c.lunchStart);
    lunchEndMin = lunchStartMin + c.lunchDurationMin;
  }

  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const currentTotalMin = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() + now.getMilliseconds() / 1000) / 60;

  let earned = 0;

  // 本月已过去的完整工作日
  for (let d = 1; d < today; d++) {
    earned += hourlyRate * workHours;
  }

  // 今天的工作时段
  if (currentTotalMin < workStart) {
    // 还没到上班时间
  } else if (currentTotalMin >= workEnd) {
    earned += hourlyRate * workHours;
  } else {
    let workedMin = currentTotalMin - workStart;
    if (lunchEndMin > lunchStartMin) {
      if (currentTotalMin > lunchEndMin) {
        workedMin -= lunchEndMin - lunchStartMin;
      } else if (currentTotalMin > lunchStartMin) {
        workedMin -= currentTotalMin - lunchStartMin;
      }
    }
    earned += hourlyRate * (workedMin / 60);
  }

  return earned;
}

/**
 * 判断当前是否在工作时间内
 */
export function isWorkingTime(c: SalaryConfig, now: Date): boolean {
  if (c.mode === 'always') return true;
  const workStart = parseTime(c.startTime);
  const workEnd = parseTime(c.endTime);
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return currentMin >= workStart && currentMin < workEnd;
}

/**
 * 格式化金额显示
 */
export function formatMoney(amount: number, decimalPlaces: number): string {
  return `¥ ${amount.toFixed(decimalPlaces)}`;
}
