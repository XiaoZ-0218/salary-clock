import * as vscode from 'vscode';
import { getConfig, calcEarned, isWorkingTime, formatMoney } from './salary';

let statusBarItem: vscode.StatusBarItem;
let timer: ReturnType<typeof setInterval> | null = null;
let isVisible = true;

export function activate(context: vscode.ExtensionContext) {
  // 创建状态栏项 —— 放在左侧，高优先级
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'salaryClock.showSettings';
  statusBarItem.tooltip = '点击设置薪资时钟 ⏰';
  context.subscriptions.push(statusBarItem);

  // 启动定时刷新
  startTicking();

  // 注册命令：打开设置
  context.subscriptions.push(
    vscode.commands.registerCommand('salaryClock.showSettings', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'salaryClock'
      );
    })
  );

  // 注册命令：切换显示
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

  // 监听配置变更，重启定时器
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('salaryClock')) {
        startTicking();
      }
    })
  );

  // 初始化显示
  updateDisplay();
}

function startTicking() {
  // 清除旧定时器
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
  const showIcon = vscode.workspace.getConfiguration('salaryClock').get<boolean>('showIcon', true);

  const prefix = showIcon ? '💰 ' : '';
  const moneyStr = formatMoney(earned, config.decimalPlaces);

  if (config.mode === 'work' && !isWorkingTime(config, now)) {
    statusBarItem.text = `${prefix}${moneyStr} 💤`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = `${prefix}${moneyStr}`;
    // 绿色背景表示正在赚钱中
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
}
