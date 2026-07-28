import * as vscode from 'vscode';
import {
  getConfig,
  calcEarned,
  isWorkingTime,
  isWorkDay,
  formatMoney,
  calcMonthWorkDays,
  getWorkHours,
  getCoveredYears,
  calcWorkProgress,
  calcWeekWorkHours,
  calcMonthWorkHours,
  progressBar,
  HOLIDAYS,
  WORKDAYS as BUILTIN_WORKDAYS,
  type SalaryConfig,
  type DayMarkEntry,
} from './salary';

let statusBarItem: vscode.StatusBarItem;
let timer: ReturnType<typeof setInterval> | null = null;
let isVisible = true;
/** 输出通道用于调试 */
let outputChannel: vscode.OutputChannel;

// ==================== 模块级缓存 ====================
/** 当月工作日统计缓存，按「年月 + 影响统计的配置」为 key */
let cachedStats: { key: string; days: number; hours: number } | undefined;
/** 上次写入状态栏的文本，用于去重，避免无谓的 UI 刷新 */
let lastStatusText: string | undefined;
/** 上次更新 tooltip 的时间戳（毫秒），用于节流避免抖动 */
let lastTooltipUpdate = 0;
/** tooltip 刷新节流间隔（毫秒）*/
const TOOLTIP_THROTTLE_MS = 30000;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('薪资时钟');
  context.subscriptions.push(outputChannel);

  // 节假日/调休数据过期检测（激活时仅提示一次）
  warnIfHolidayDataStale();

  // 状态栏项
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  // 状态栏点击 = 打开设置
  statusBarItem.command = 'salaryClock.showSettings';
  statusBarItem.tooltip = '点击打开薪资时钟设置 ⚙️';
  context.subscriptions.push(statusBarItem);

  startTicking();

  // 命令：打开设置
  context.subscriptions.push(
    vscode.commands.registerCommand('salaryClock.showSettings', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'salaryClock'
      );
    })
  );

  // 命令：切换状态栏显示
  context.subscriptions.push(
    vscode.commands.registerCommand('salaryClock.toggleDisplay', () => {
      isVisible = !isVisible;
      if (isVisible) {
        statusBarItem.show();
        vscode.window.showInformationMessage('薪资时钟已显示 💰');
      } else {
        statusBarItem.hide();
        vscode.window.showInformationMessage('薪资时钟已隐藏 🙈');
      }
    })
  );

  // 命令：调试输出
  context.subscriptions.push(
    vscode.commands.registerCommand('salaryClock.debug', () => {
      debugInfo();
    })
  );

  // 命令：调休 图形化增删（节假日由内置固定，不暴露用户编辑）
  context.subscriptions.push(
    vscode.commands.registerCommand('salaryClock.addWorkday', () => promptAddWorkday()),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('salaryClock.removeWorkday', () => promptRemoveWorkday()),
  );

  // 配置变更监听
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('salaryClock')) {
        // 配置变了：统计缓存失效，重启 ticking（间隔可能变了）
        cachedStats = undefined;
        startTicking();
      }
    })
  );

  updateDisplay();
}

/** 当前年份超出节假日数据覆盖区间时告警一次 */
function warnIfHolidayDataStale() {
  const [minYear, maxYear] = getCoveredYears();
  const nowYear = new Date().getFullYear();
  if (nowYear < minYear || nowYear > maxYear) {
    const msg = `薪资时钟：节假日/调休数据仅覆盖 ${minYear}-${maxYear} 年，当前 ${nowYear} 年数据缺失，工作日判断将退化为「仅按周末」，计薪可能不准。`;
    console.warn(msg);
    vscode.window.showWarningMessage(msg);
  }
}

// ==================== 当月工作日统计（缓存复用） ====================

/**
 * 返回当月工作日统计，按「年月 + 影响统计的配置字段」缓存，
 * 仅在配置变更或跨月时才重算，供 updateDisplay 与 debugInfo 共用。
 */
function getMonthStats(config: SalaryConfig, year: number, month: number): { days: number; hours: number } {
  // 缓存 key 必须包含所有会影响 calcMonthWorkDays 结果的字段
  // —— 漏字段会在配置切换时静默返回旧统计（pi R2-P1-2）。
  const wa = config.workdayAdjustment === false ? '0' : '1';
  const wd = config.workdays ? Object.keys(config.workdays).length : 0;
  const key = `${year}-${month}|${config.mode}|${config.startTime}|${config.endTime}|${config.lunchDurationMin}|wa${wa}|wd${wd}`;
  if (!cachedStats || cachedStats.key !== key) {
    const { days, hours } = calcMonthWorkDays(config, year, month);
    cachedStats = { key, days, hours };
  }
  return cachedStats;
}

// ==================== 状态栏跳动 ====================

function startTicking() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  const cfg = vscode.workspace.getConfiguration('salaryClock');
  const intervalMs = cfg.get<number>('8interval', 250);

  timer = setInterval(() => {
    updateDisplay();
  }, intervalMs);
}

function updateDisplay() {
  const config = getConfig();
  const now = new Date();
  const earned = calcEarned(config, now);
  const working = isWorkingTime(config, now);
  const wd = isWorkDay(now, HOLIDAYS, config.workdays, config.workdayAdjustment ?? true);
  const showIcon = vscode.workspace.getConfiguration('salaryClock').get<boolean>('9icon', true);

  const prefix = showIcon ? '💰 ' : '';
  const moneyStr = formatMoney(earned, config.decimalPlaces);
  const showProgress = vscode.workspace.getConfiguration('salaryClock').get<boolean>('Aprogress', false);

  // 计算今日工作进度
  const dayProgress = calcWorkProgress(config, now);
  const dayProgressPercent = (dayProgress * 100).toFixed(config.decimalPlaces);
  const dayBar = progressBar(dayProgress);

  // 单日工时
  const dailyHours = getWorkHours(config);

  // 本周进度（按工时计算，含今天完整 8h 作为分母）
  const weekHours = calcWeekWorkHours(config, now);
  const weekRatio = weekHours.total > 0 ? weekHours.worked / weekHours.total : 0;
  const weekBar = progressBar(Math.min(1, weekRatio));

  // 本月进度（按工时计算，含今天完整 8h 作为分母）
  const monthHours = calcMonthWorkHours(config, now);
  const monthRatio = monthHours.total > 0 ? monthHours.worked / monthHours.total : 0;
  const monthBar = progressBar(Math.min(1, monthRatio));

  // 今日已工作小时数（用 calcWorkProgress 单独算一次，确保与今日进度一致）
  const dayWorkedHours = calcWorkProgress(config, now) * dailyHours;
  const dayHoursStr = `${dayWorkedHours.toFixed(2)}h / ${dailyHours.toFixed(2)}h`;

  // 本周已工作小时数
  const weekHoursStr = `${weekHours.worked.toFixed(2)}h / ${weekHours.total.toFixed(2)}h`;

  // 本月已工作小时数
  const monthHoursStr = `${monthHours.worked.toFixed(2)}h / ${monthHours.total.toFixed(2)}h`;

  // tooltip（MarkdownString，VS Code 渲染 markdown / $(icon)）
  const modeLabel = config.mode === 'work' ? '上班才赚钱' : '随时都赚钱';
  const wdLabel = wd === true ? '✅ 工作日' : wd === 'half' ? '🕐 半天' : '❌ 休息日';
  const workLabel = working ? '🟢 赚钱中' : '💤 休息中';

  const md = new vscode.MarkdownString(
    [
      `💰 **${moneyStr}** · ${workLabel} · ${wdLabel} · ${modeLabel}`,
      ``,
      `**今日** ${dayBar} **${(dayProgress * 100).toFixed(2)}%**  ${dayHoursStr}`,
      ``,
      `**本周** ${weekBar} **${(weekRatio * 100).toFixed(2)}%**  ${weekHoursStr}`,
      ``,
      `**本月** ${monthBar} **${(monthRatio * 100).toFixed(2)}%**  ${monthHoursStr}`,
      ``,
      `⚙️ 点击打开设置`,
    ].join('\n'),
    true,
  );

  // 节流 tooltip 更新：距离上次更新不足 30 秒则跳过，减少抖动
  const nowMs = Date.now();
  if (nowMs - lastTooltipUpdate >= TOOLTIP_THROTTLE_MS) {
    statusBarItem.tooltip = md;
    lastTooltipUpdate = nowMs;
  }

  let text: string;
  if (config.mode === 'work' && !working) {
    text = `${prefix}${moneyStr} 💤`;
    statusBarItem.backgroundColor = undefined;
  } else if (showProgress) {
    // 同时显示薪资和今日进度百分比
    text = `${prefix}${moneyStr} | ${dayProgressPercent}%`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    text = `${prefix}${moneyStr}`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  // 文本无变化则不触碰 text，减少无谓刷新
  if (text !== lastStatusText) {
    statusBarItem.text = text;
    lastStatusText = text;
  }

  // 尊重用户的显示/隐藏开关（修复：此前无条件 show() 导致 toggle 失效）
  if (isVisible) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

export function deactivate() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  // statusBarItem 已在 activate 时推入 context.subscriptions，停用时由 VS Code 自动 dispose
}

// ==================== 调试 ====================

function debugInfo() {
  const config = getConfig();
  const now = new Date();
  const earned = calcEarned(config, now);
  const working = isWorkingTime(config, now);
  const wd = isWorkDay(now, HOLIDAYS, config.workdays, config.workdayAdjustment ?? true);

  // 当月统计（与 updateDisplay 共用一处实现）
  const stats = getMonthStats(config, now.getFullYear(), now.getMonth());
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyHours = getWorkHours(config);
  const hourlyRate = config.monthlySalary / (stats.hours || 1);

  const lines = [
    `=== 薪资时钟调试 ${now.toLocaleString('zh-CN')} ===`,
    `配置: 月薪=${config.monthlySalary} 模式=${config.mode} 上班=${config.startTime} 下班=${config.endTime} 午休=${config.lunchDurationMin}分钟(${config.lunchStart}开始)`,
    `当月: ${now.getFullYear()}年${now.getMonth() + 1}月 共${dim}天 ${stats.days}个工作日 日工时${dailyHours}h 总工时${stats.hours}h`,
    `时薪: ¥${hourlyRate.toFixed(2)}/h`,
    `今天: isWorkDay=${wd} isWorkingTime=${working}`,
    `已赚: ${formatMoney(earned, config.decimalPlaces)}`,
    `状态栏: ${statusBarItem.text}`,
    ``,
  ];

  outputChannel.append(lines.join('\n'));
  outputChannel.show(true);
  vscode.window.showInformationMessage(`调试信息已输出到"薪资时钟"面板 📋`);
}

// ==================== 节假日/调休 图形化编辑 ====================

const DATE_RE_INPUT = /^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/;

/**
 * 解析用户输入 "YYYY-MM-DD 名称"，返回 {date, name} 或 undefined（输入取消/格式错）。
 * 校验日期格式 + 名称非空。
 */
function parseAddInput(input: string): { date: string; name: string } | undefined {
  const m = DATE_RE_INPUT.exec(input.trim());
  if (!m) return undefined;
  const [, y, mo, d, name] = m;
  const yyyy = Number(y), mm = Number(mo), dd = Number(d);
  // 用 Date 反查校验日期合法性（处理 2026-02-30 这类）
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return undefined;
  const trimmedName = name.trim();
  if (!trimmedName) return undefined;
  return { date: `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, name: trimmedName };
}

/** 读取用户在 settings.json 中的 workdays 数组（节假日内置固定，无此函数） */
function readUserWorkdays(): DayMarkEntry[] {
  return vscode.workspace.getConfiguration('salaryClock').get<DayMarkEntry[]>('Bworkdays', []) ?? [];
}

/** 写入用户在 settings.json 中的 workdays 数组 */
async function writeUserWorkdays(value: DayMarkEntry[]): Promise<void> {
  await vscode.workspace.getConfiguration('salaryClock')
    .update('Bworkdays', value, vscode.ConfigurationTarget.Global);
}

/**
 * 添加调休：弹 InputBox 输入 "YYYY-MM-DD 名称"，回车写入用户配置。
 * 节假日由内置固定，不暴露用户编辑。
 */
async function promptAddWorkday(): Promise<void> {
  const input = await vscode.window.showInputBox({
    title: '添加调休',
    prompt: '格式：YYYY-MM-DD 调休名（例：2027-01-02 元旦调休）',
    placeHolder: '2027-01-02 元旦调休',
    validateInput: (v) => {
      if (!v.trim()) return '不能为空';
      const parsed = parseAddInput(v);
      if (!parsed) return '格式错误：应为 YYYY-MM-DD 名称（注意空格分隔）';
      return undefined;
    },
  });
  if (!input) return; // 用户取消

  const parsed = parseAddInput(input);
  if (!parsed) return;

  const userList = readUserWorkdays();
  if (userList.some((e) => e.date === parsed.date)) {
    vscode.window.showWarningMessage(`调休 ${parsed.date} 已在用户配置中，无需重复添加`);
    return;
  }
  // 提示用户配置将覆盖内置同名条目
  if (BUILTIN_WORKDAYS[parsed.date]) {
    const choice = await vscode.window.showInformationMessage(
      `${parsed.date} 已存在于内置调休「${BUILTIN_WORKDAYS[parsed.date].name}」，继续将以你输入的名称覆盖`,
      { modal: true },
      '覆盖',
    );
    if (choice !== '覆盖') return;
  }

  userList.push({ date: parsed.date, name: parsed.name });
  await writeUserWorkdays(userList);
  vscode.window.showInformationMessage(`已添加调休 ${parsed.date} ${parsed.name} ✅`);
}

/**
 * 删除调休：QuickPick 列出用户配置的所有条目，选一项从用户配置移除。
 * 内置未被用户覆盖的不显示（提示"内置不可通过此命令删除"）。
 */
async function promptRemoveWorkday(): Promise<void> {
  const userList = readUserWorkdays();
  if (userList.length === 0) {
    vscode.window.showInformationMessage('用户配置中没有调休，内置调休不可通过此命令删除');
    return;
  }

  const picks = userList
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      label: `${e.date}  ${e.name}`,
      date: e.date,
      // 区分：覆盖内置 vs 纯自定义，删除影响不同
      description: BUILTIN_WORKDAYS[e.date]
        ? '用户覆盖 · 删除后恢复内置定义'
        : '用户自定义 · 删除后永久移除',
    }));

  const picked = await vscode.window.showQuickPick(picks, {
    title: '删除调休',
    placeHolder: '选择要删除的条目',
  });
  if (!picked) return;

  const newList = userList.filter((e) => e.date !== picked.date);
  await writeUserWorkdays(newList);
  vscode.window.showInformationMessage(`已删除调休 ${picked.date} 🗑`);
}
