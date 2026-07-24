import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig, calcEarned, isWorkingTime, formatMoney } from './salary';

let statusBarItem: vscode.StatusBarItem;
let timer: ReturnType<typeof setInterval> | null = null;
let isVisible = true;

export function activate(context: vscode.ExtensionContext) {
  // 状态栏项
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'salaryClock.showSettings';
  statusBarItem.tooltip = '点击设置薪资时钟 ⏰';
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

  // 配置变更监听
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('salaryClock')) {
        startTicking();
      }
    })
  );

  updateDisplay();
}

// ==================== WebView 时钟面板 ====================

function openClockPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'salaryClock',
    '哄我上班 😽',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'web'),
        vscode.Uri.joinPath(context.extensionUri, 'img'),
      ],
    }
  );

  // 读取 index.html 并注入资源路径
  const htmlPath = path.join(context.extensionUri.fsPath, 'web', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // 替换相对路径的资源为 webview URI
  const webUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'web')
  );
  const imgUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'img')
  );

  // 替换 manifest 和图标路径
  html = html.replace(
    /href="site\.webmanifest[^"]*"/g,
    `href="${webUri}/site.webmanifest"`
  );
  html = html.replace(
    /href="img\/([^"]+)"/g,
    `href="${imgUri}/$1"`
  );

  panel.webview.html = html;
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
  const showIcon = vscode.workspace.getConfiguration('salaryClock').get<boolean>('showIcon', true);

  const prefix = showIcon ? '💰 ' : '';
  const moneyStr = formatMoney(earned, config.decimalPlaces);

  if (config.mode === 'work' && !isWorkingTime(config, now)) {
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
}
