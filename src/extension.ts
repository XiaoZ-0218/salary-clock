import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig, calcEarned, isWorkingTime, isWorkDay, formatMoney, HOLIDAYS, WORKDAYS } from './salary';

let statusBarItem: vscode.StatusBarItem;
let timer: ReturnType<typeof setInterval> | null = null;
let isVisible = true;
/** 输出通道用于调试 */
let outputChannel: vscode.OutputChannel;
/** 当前活动的 WebView 面板 */
let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('薪资时钟');
  context.subscriptions.push(outputChannel);

  // 状态栏项
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'salaryClock.openClock';
  statusBarItem.tooltip = '点击打开时钟面板 ⏰';
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

// ==================== WebView 时钟面板 ====================

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

  // 面板关闭时清理引用
  panel.onDidDispose(() => {
    currentPanel = undefined;
  });

  // 读取 index.html
  const htmlPath = path.join(context.extensionUri.fsPath, 'web', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');

  panel.webview.html = html;

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

  // 兜底：短延迟后发送配置
  setTimeout(() => {
    sendConfigToWebview(panel);
  }, 500);
}

function sendConfigToWebview(panel: vscode.WebviewPanel) {
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
    holidays: HOLIDAYS,
    workdays: WORKDAYS,
  });
}

// ==================== 状态栏跳动 ====================

function startTicking() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  const cfg = vscode.workspace.getConfiguration('salaryClock');
  const intervalMs = cfg.get<number>('updateIntervalMs', 100);

  timer = setInterval(() => {
    updateDisplay();
  }, intervalMs);
}

function updateDisplay() {
  const config = getConfig();
  const now = new Date();
  const earned = calcEarned(config, now);
  const working = isWorkingTime(config, now);
  const wd = isWorkDay(now);
  const showIcon = vscode.workspace.getConfiguration('salaryClock').get<boolean>('showIcon', true);

  const prefix = showIcon ? '💰 ' : '';
  const moneyStr = formatMoney(earned, config.decimalPlaces);

  // tooltip 显示完整信息
  const modeLabel = config.mode === 'work' ? '上班才赚钱' : '随时都赚钱';
  const wdLabel = wd === true ? '✅ 工作日' : wd === 'half' ? '🕐 半天' : '❌ 休息日';
  const workLabel = working ? '🟢 赚钱中' : '💤 休息中';
  const dailyHours = (() => {
    const s = config.startTime.split(':').map(Number);
    const e = config.endTime.split(':').map(Number);
    return (e[0] * 60 + e[1] - s[0] * 60 - s[1] - config.lunchDurationMin) / 60;
  })();
  // 当月工作日
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let workDayCount = 0;
  for (let d = 1; d <= dim; d++) {
    if (isWorkDay(new Date(now.getFullYear(), now.getMonth(), d))) workDayCount++;
  }
  const totalHours = workDayCount * dailyHours;
  const hourlyRate = config.monthlySalary / (totalHours || 1);

  statusBarItem.tooltip = [
    `点击打开时钟面板`,
    `${moneyStr}`,
    `模式: ${modeLabel}  |  ${wdLabel}  |  ${workLabel}`,
    `月薪: ¥${config.monthlySalary.toLocaleString()}  |  时薪: ¥${hourlyRate.toFixed(2)}`,
    `工作时间: ${config.startTime}-${config.endTime}  |  午休: ${config.lunchDurationMin}分钟`,
    `${now.getFullYear()}年${now.getMonth()+1}月: ${workDayCount}个工作日 × ${dailyHours}h = ${totalHours}h`,
    `🖱️ 点击打开时钟面板 | Ctrl+Shift+P → 薪资时钟: 设置 可修改配置`,
  ].join('\n');

  if (config.mode === 'work' && !working) {
    statusBarItem.text = `${prefix}${moneyStr} 💤`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = `${prefix}${moneyStr}`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  statusBarItem.show();
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
  const wd = isWorkDay(now);

  // 计算当月工作日
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let workDayCount = 0;
  for (let d = 1; d <= dim; d++) {
    if (isWorkDay(new Date(now.getFullYear(), now.getMonth(), d))) workDayCount++;
  }
  const dailyHours = (() => {
    const start = config.startTime.split(':').map(Number);
    const end = config.endTime.split(':').map(Number);
    return (end[0] * 60 + end[1] - start[0] * 60 - start[1] - config.lunchDurationMin) / 60;
  })();

  const lines = [
    `=== 薪资时钟调试 ${now.toLocaleString('zh-CN')} ===`,
    `配置: 月薪=${config.monthlySalary} 模式=${config.mode} 上班=${config.startTime} 下班=${config.endTime} 午休=${config.lunchDurationMin}分钟(${config.lunchStart}开始)`,
    `当月: ${now.getFullYear()}年${now.getMonth()+1}月 共${dim}天 ${workDayCount}个工作日 日工时${dailyHours}h 总工时${workDayCount*dailyHours}h`,
    `时薪: ¥${(config.monthlySalary/(workDayCount*dailyHours)).toFixed(2)}/h`,
    `今天: isWorkDay=${wd} isWorkingTime=${working}`,
    `已赚: ${formatMoney(earned, config.decimalPlaces)}`,
    `状态栏: ${statusBarItem.text}`,
    ``,
  ];

  outputChannel.append(lines.join('\n'));
  outputChannel.show(true);
  vscode.window.showInformationMessage(`调试信息已输出到"薪资时钟"面板 📋`);
}
