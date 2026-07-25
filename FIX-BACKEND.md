# FIX-BACKEND.md — src/ 端核心修复与重构

分支：`fix/backend-review`　工作目录：`worktrees/salary-clock/fix-backend`
仅改动 `src/*.ts` 与 `package.json`，未触碰 `web/` 与测试文件。

## 验证结果
- `npm run compile`（tsc）→ **退出 0**（需先 `npm install` 装 @types/vscode、@types/node）。
- `out/salary-core.js` 独立 `require` 通过，行为逐条校验全部符合预期。
- `out/extension.js` 单独 `require` 抛 `Cannot find module 'vscode'` —— **属预期且既有行为**：`vscode` 模块只在 VS Code 宿主内存在，原 `extension.ts` 首行同样 `import * as vscode`，非本次改动引入。

## P0 修复
| # | 问题 | 处理 |
|---|------|------|
| 1 | `updateDisplay` 末尾无条件 `show()` 使 `toggleDisplay` 失效 | 结尾改为按模块级 `isVisible` 决定 `show()/hide()`；toggle 后多次 tick 保持隐藏。 |
| 2 | `always` 模式被工作时段守卫阻断 + 死代码 | `calcEarned` 顶部先判 `mode==='always'`，直接 `monthlySalary*(now-月初)/(下月-月初)`，不依赖 startTime/endTime/lunch；`calcMonthWorkDays` always 分支返回 `{days:dim, hours:dim*24}`。 |
| 3 | NaN 传播 | `parseTime` 用 `^([01]\d\|2[0-3]):[0-5]\d$` 严格校验，非法返回 `null`；`getConfig` 对时间字段兜底默认；`calcEarned` 顶部 `!Number.isFinite(workHours)\|\|workHours<=0` 及 `monthlySalary` 同款守卫；`formatMoney` `!Number.isFinite→'¥ —'`。 |
| 4 | `fs.readFileSync` 无 try-catch | 新增 `loadPanelHtml`：try-catch + `showErrorMessage`，失败回退 `<h1>无法加载时钟面板资源</h1>`；读到的 html 缓存到模块级 `cachedHtml` 复用，省重复 I/O。 |

## P1 修复
| # | 问题 | 处理 |
|---|------|------|
| 5 | `calcEarned` 与 `isWorkingTime` 午休判断不一致 | 抽出单一来源 `isWorkingMinute(nowMin,workStart,workEnd,lunchStart,lunchEnd)`；`isWorkingTime` 直接调用；`calcEarned` 今日累计用共享边界的 `workedMinutesSoFar`，两者午休窗口一致（`isWorkingTime` 现已正确扣午休）。 |
| 6 | 节假日/调休数据过期无提示 | 新增 `export getCoveredYears()` 返回 `[2024,2026]`；`activate` 时 `warnIfHolidayDataStale` 越界则 `console.warn` + `showWarningMessage`（仅激活一次）。 |
| 7 | `sendConfigToWebview` 无 dispose 守卫 | `setTimeout` 句柄 `readyTimer` 保存并在 `onDidDispose` 中 `clearTimeout`；`sendConfigToWebview` 加 `currentPanel===panel` 校验 + try-catch。 |
| 8 | `getConfig` 无 clamp/类型校验 | `monthlySalary` 非有限或负→20000；`lunchDurationMin` clamp 0–600；`decimalPlaces` clamp 0–6 取整；时间字段 `parseTime` 校验失败→默认值。 |
| 9 | `isWorkDay` 半天死分支 | 保留 `'half'` 逻辑（不删，留扩展余地），统一按 0.5 权重（`workDayWeight` 辅助函数），文件顶部注释说明当前为死分支及原因。 |

## 重构（高 ROI）
- **10 拆分纯计算**：新建 `src/salary-core.ts`（**零 vscode 依赖**），迁入 `HOLIDAYS/WORKDAYS/formatDate/parseTime/getWorkHours/calcMonthWorkDays/calcEarned/isWorkDay/isWorkingTime/formatMoney`（外加 `getCoveredYears/isWorkingMinute`）。`src/salary.ts` 仅留 `getConfig` 并 `export * from './salary-core'`，既有 import 路径不破坏。
- **11 统一月统计**：`extension.ts` 内 `updateDisplay` 与 `debugInfo` 共用 `getMonthStats()` → `calcMonthWorkDays(config,year,month)`，删除两份重复的内联工作日/工时计算。加模块级缓存 `cachedHtml`、`cachedStats`（按「年月+影响统计的配置字段」为 key，配置变更或跨月才重算）、`lastStatusText`。
- **12 刷新与去重**：`package.json` `updateIntervalMs` 默认 `100→250`（4 位小数下更可读）；`updateDisplay` 加「格式化文本与上次相同则不写 `text`」守卫。

## 新增 / 改动文件
- 新增：`src/salary-core.ts`
- 改动：`src/salary.ts`（瘦身为配置层 + re-export）、`src/extension.ts`（缓存/守卫/toggle/去重）、`package.json`（默认间隔 250）
