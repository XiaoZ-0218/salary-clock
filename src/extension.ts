import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  getConfig,
  calcEarned,
  isWorkingTime,
  isWorkDay,
  formatMoney,
  calcMonthWorkDays,
  getWorkHours,
  getCoveredYears,
  SalaryConfig,
} from './salary';

let statusBarItem: vscode.StatusBarItem;
let timer: ReturnType<typeof setInterval> | null = null;
let isVisible = true;
/** 输出通道用于调试 */
let outputChannel: vscode.OutputChannel;
/** 当前活动的 WebView 面板 */
let currentPanel: vscode.WebviewPanel | undefined;

// ==================== 模块级缓存 ====================
/** index.html 内容缓存（extensionUri 不变，读一次即可复用，省 I/O） */
let cachedHtml: string | undefined;
/** 当月工作日统计缓存，按「年月 + 影响统计的配置」为 key */
let cachedStats: { key: string; days: number; hours: number } | undefined;
/** 上次写入状态栏的文本，用于去重，避免无谓的 UI 刷新 */
let lastStatusText: string | undefined;

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
  // 状态栏点击 = 打开设置（WebView 时钟面板通过命令面板 / alt+shift+d 打开）
  statusBarItem.command = 'salaryClock.showSettings';
  statusBarItem.tooltip = '点击打开薪资时钟设置 ⚙️';
  context.subscriptions.push(statusBarItem);

  startTicking();

  // 命令：打开完整时钟面板（WebView）
  context.subscriptions.push(
    vscode.commands.registerCommand('salaryClock.openClock', () => {
      openClockPanel(context);
    })
  );

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

  // 配置变更监听
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('salaryClock')) {
        // 配置变了：统计缓存失效，重启 ticking（间隔可能变了）
        cachedStats = undefined;
        startTicking();
        // 如果有活动的 WebView 面板，同步配置过去
        if (currentPanel) {
          sendConfigToWebview(currentPanel);
        }
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

// ==================== WebView 时钟面板 ====================

/** 读取并缓存 index.html；读取失败返回 undefined 并提示用户 */
function loadPanelHtml(context: vscode.ExtensionContext): string | undefined {
  if (cachedHtml !== undefined) return cachedHtml;
  try {
    const htmlPath = path.join(context.extensionUri.fsPath, 'web', 'index.html');
    cachedHtml = fs.readFileSync(htmlPath, 'utf-8');
    return cachedHtml;
  } catch (err) {
    vscode.window.showErrorMessage(`薪资时钟：无法加载时钟面板资源（${String(err)}）`);
    return undefined;
  }
}

function openClockPanel(context: vscode.ExtensionContext) {
  // 如果已有面板，先关闭旧的
  if (currentPanel) {
    currentPanel.dispose();
  }

  const panel = vscode.window.createWebviewPanel(
    'salaryClock',
    '哄我上班 😽',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'web'),
      ],
    }
  );

  currentPanel = panel;

  // 读取 index.html（带缓存与错误兜底）
  const html = loadPanelHtml(context);
  panel.webview.html = html ?? '<h1>无法加载时钟面板资源</h1>';

  // 兜底：短延迟后发送配置（句柄保存，dispose 时清理）
  const readyTimer = setTimeout(() => {
    sendConfigToWebview(panel);
  }, 500);

  // 面板关闭时清理引用与定时器
  panel.onDidDispose(() => {
    if (currentPanel === panel) currentPanel = undefined;
    clearTimeout(readyTimer);
  });

  // 监听 webview 就绪消息
  panel.webview.onDidReceiveMessage((message) => {
    if (message.type === 'ready') {
      sendConfigToWebview(panel);
    }
  });

  // 当面板重新变为可见时也发送配置
  panel.onDidChangeViewState((e) => {
    if (e.webviewPanel.visible) {
      sendConfigToWebview(panel);
    }
  });
}

function sendConfigToWebview(panel: vscode.WebviewPanel) {
  // 面板已被替换/关闭则直接跳过，避免向已 dispose 的 webview 投递消息
  if (currentPanel !== panel) return;
  try {
    const config = getConfig();
    const theme = vscode.workspace.getConfiguration('salaryClock').get<string>('theme', 'aurora');

    panel.webview.postMessage({
      type: 'config',
      monthlySalary: config.monthlySalary,
      startTime: config.startTime,
      endTime: config.endTime,
      lunchDurationMin: config.lunchDurationMin,
      lunchStart: config.lunchStart,
      mode: config.mode,
      decimalPlaces: config.decimalPlaces,
      theme,
      holidays: config.holidays ?? {},
      workdays: config.workdays ?? {},
    });
  } catch (err) {
    // 面板可能已在投递前 dispose；静默忽略即可
    console.warn('薪资时钟：向面板发送配置失败', err);
  }
}

// ==================== 当月工作日统计（缓存复用） ====================

/**
 * 返回当月工作日统计，按「年月 + 影响统计的配置字段」缓存，
 * 仅在配置变更或跨月时才重算，供 updateDisplay 与 debugInfo 共用。
 */
function getMonthStats(config: SalaryConfig, year: number, month: number): { days: number; hours: number } {
  const key = `${year}-${month}|${config.mode}|${config.startTime}|${config.endTime}|${config.lunchDurationMin}`;
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
  const intervalMs = cfg.get<number>('updateIntervalMs', 250);

  timer = setInterval(() => {
    updateDisplay();
  }, intervalMs);
}

function updateDisplay() {
  const config = getConfig();
  const now = new Date();
  const earned = calcEarned(config, now);
  const working = isWorkingTime(config, now);
  const wd = isWorkDay(now, config.holidays, config.workdays);
  const showIcon = vscode.workspace.getConfiguration('salaryClock').get<boolean>('showIcon', true);

  const prefix = showIcon ? '💰 ' : '';
  const moneyStr = formatMoney(earned, config.decimalPlaces);

  // 当月统计（缓存复用，仅配置变更/跨月时重算）
  const stats = getMonthStats(config, now.getFullYear(), now.getMonth());
  const dailyHours = getWorkHours(config);
  const totalHours = stats.hours;
  const hourlyRate = config.monthlySalary / (totalHours || 1);

  // tooltip（MarkdownString，VS Code 渲染 markdown / $(icon)）
  const modeLabel = config.mode === 'work' ? '上班才赚钱' : '随时都赚钱';
  const wdLabel = wd === true ? '✅ 工作日' : wd === 'half' ? '🕐 半天' : '❌ 休息日';
  const workLabel = working ? '🟢 赚钱中' : '💤 休息中';
  const md = new vscode.MarkdownString(
    [
      `💰 **${moneyStr}** · ${workLabel} · ${wdLabel} · ${modeLabel}`,
      ``,
      `⏱️ 时薪 **¥${hourlyRate.toFixed(2)}/h** · 工时 ${config.startTime}–${config.endTime}（午休 ${config.lunchDurationMin}min）`,
      `📅 ${now.getFullYear()}年${now.getMonth() + 1}月：${stats.days} 工作日 × ${dailyHours}h = ${totalHours}h`,
      ``,
      `⚙️ 点击打开设置 · Alt+Shift+D 打开时钟面板`,
    ].join('\n'),
    true, // supportThemeIcons
  );
  statusBarItem.tooltip = md;

  let text: string;
  if (config.mode === 'work' && !working) {
    text = `${prefix}${moneyStr} 💤`;
    statusBarItem.backgroundColor = undefined;
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
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (currentPanel) {
    currentPanel.dispose();
    currentPanel = undefined;
  }
}

// ==================== 调试 ====================

function debugInfo() {
  const config = getConfig();
  const now = new Date();
  const earned = calcEarned(config, now);
  const working = isWorkingTime(config, now);
  const wd = isWorkDay(now, config.holidays, config.workdays);

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
