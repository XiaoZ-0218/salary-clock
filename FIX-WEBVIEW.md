# Fix 任务 B 报告：web/ 端 WebView 修复与性能

工作 worktree：`fix-webview`（分支 `fix/webview-review`）
修改文件：`web/index.html`（仅此一个）
commit：`338857e`

---

## 改动清单（按报告章节归类）

### 性能 P0 — 月度缓存 & O(1) 增量

之前的 `animateClock` 每帧调用 `getEarnedAtTime(now)`，里面：
1. 调 `calculateMonthWorkDays(year, month)` —— 整月 30 次 `new Date + isWorkDay`
2. 「本月已过去完整工作日」再扫一遍 ≈29 次 `isWorkDay`
3. 当天增量还得另外算

每帧 ≈45 次 `isWorkDay + Date` + 4 位小数的 `toLocaleString`。

**修复**：引入 `_monthStats` 单例缓存，按 `YYYY-MM` 缓存以下内容：

| 字段 | 含义 | 何时重算 |
| --- | --- | --- |
| `totalDays` / `totalHours` | 整月工作日数 & 工时 | 跨月 / 配置变更 |
| `workHours` / `hourlyRate` | 班次小时数 & 时薪 | 跨月 / 配置变更 |
| `dailyEarned` | 一天满额 | 跨月 / 配置变更 |
| `passedDaysEarned` | 月初到「昨天」的累计 | 跨月 / 跨日 / 配置变更 |
| `lastTodayDate` | 上次看到的 today | 跨日时增量更新 `passedDaysEarned` |

新函数 `todayEarned(now)` 仅做：
- 缓存命中 → 直接读 `passedDaysEarned`
- 跨日 → 增量扫 `(lastToday, today)` 区间
- 算当天已工作的分钟数（含午休扣减）
- 返回 `passedDaysEarned + todayInc`

**量化**（粗略）：每帧 `isWorkDay` 调用从 ≈45 降到 ≈0–1（跨日那帧会扫 ≤30 次），
每帧 `new Date` 也显著减少；同时 `updateClockSub` 复用同一缓存，`hourlyRate/dailyHours` 不再每次重算。

### 性能 P0 — DOM 写入节流

新增 `setText(el, value)` / `setClass(el, cls, on)` / `setDisplay(node, value)` 三个守卫工具：
- `setText`：`el.textContent !== value` 才写
- `setClass`：先 `contains` 判断再 add/remove
- `setDisplay`：先比较 `node.style.display === value`

`animateClock` 里金额、opacity、`clockDisplay.style.display` 都改为走守卫。
仅 `textContent` 一项就把每帧重排/重绘降到「真变化才触发」。

新增 `_displayMode` 状态机：`animateClock` 仅在 `'countdown' ↔ 'work'` 切换时写 `display` 与 `.hidden`，路径中三态切换与原意等价（`mode !== 'work'` 也走 `'work'` 支路，因 `isInWorkTime` 在非 work 模式下恒 true）。

### P1 — `decimalPlaces`

之前 `formatMoney(n)` 硬编码 4 位，postMessage handler 不接收 `decimalPlaces`。
现在：
- `resolveDp(dp)` 自动 clamp 到 `[0, 6]`、非有限值兜底为 4（`config.decimalPlaces` 兜底）
- `formatMoney(n, dp?)` 使用 `dp`（未传则走 `config.decimalPlaces`）
- `formatMoneyShort(n, dp?)` 副指标走 2 位（可显式覆盖）
- `postMessage` 接收 `msg.decimalPlaces`，并以 `resolveDp` 规范化后写入 `config.decimalPlaces`
- 默认配置加 `decimalPlaces: 4`

### P1 — 跨月刷新副指标

`animateClock` 顶部做 `currentMonthKey !== _lastMonthKey` 检测，跨月时调 `updateClockSub()` 再写缓存。
`_lastMonthKey` 在模块作用域持有，月份变化驱动刷新，不再依赖 `postMessage` 触发。

### P1 — 午休一致性

`isInWorkTime` 在 `[workStart, workEnd)` 之内还要排除 `[lunchStart, lunchStart + lunchDurationMin)`，
与 `src/salary.ts` 的 `isWorkingTime` 语义对齐。
`todayEarned` 中午休扣减逻辑保留不变 —— 现在 `isInWorkTime=false` 与 `todayEarned` 增量持平双向一致。

> 注意：午休开始前一刻钟 `isInWorkTime` 还是 true，但今天的金额增量不会变 —— 这与扩展端 `calcEarned` 也是同款语义，已对齐。

### P1 — 节假日/调休优先级

`isWorkDay` 现在先判 `config.holidays[ds] → false` 再判 `config.workdays[ds] → true`，
与 `src/salary.ts:77-79` 完全一致。重叠日期由法定节假日胜出。

### P1 — CSP

`<head>` 加：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
```

附注释说明：当前全部脚本/样式内联，所以使用 `unsafe-inline`；
nonce 方案需要扩展端注入（`extension.ts` 端生成 nonce 注入 HTML），可后续切换。

### P1 — 默认值对齐 `package.json`

| 字段 | WebView 旧值 | WebView 新值 | 扩展默认值 |
| --- | --- | --- | --- |
| `startTime` | `'10:00'` | `'09:00'` | `'09:00'` |
| `endTime` | `'18:30'` | `'18:00'` | `'18:00'` |
| `lunchDurationMin` | `120` | `60` | `60` |

postMessage 到达前首帧的渲染不会再用错误默认值。

### P2 — 1Hz 节流

`_lastSecondTick` 模块级变量。`animateClock` 在非工作时段分支：
- `sec === _lastSecondTick` → return（相当于挂钟不动）
- 否则写入 `_lastSecondTick = sec` 并刷新倒计时与激励语

1Hz 节流后，「下班」/「周末」/「午休」/「上班前」等时段下，DOM 写入频率从 60Hz 降到 1Hz。
工作时段仍每帧更新数字（毫秒级金额）。

### P2 — `updateClockSub` 内部缓存

`updateClockSub` 调用 `ensureMonthStats(now)`，复用动画循环同一份 `_monthStats`，
不再独立调 `calculateMonthWorkDays`。
当 `_monthStats` 命中缓存（即同月同配置），`hourlyRate / workHours` 全部来自缓存。
剩余工作日还得扫一遍 `now.getDate()..dim`，但只读 `stats.year`/`stats.month`，省去函数调用与对象构造。

---

## 验证

### 1. 静态验证（必需）✓

```bash
$ node -e "const fs=require('fs');const html=fs.readFileSync('web/index.html','utf-8');if(!html.includes('decimalPlaces'))throw 'dp not used';console.log('ok')"
ok
```

### 2. JS 语法校验 ✓

提取 `<script>` 块用 `new Function(src)` 解析通过，控制台输出 `js-syntax-ok`。

### 3. 行为单元小测（手工跑 node）✓

```
Tue 2026-07-28 isWorkDay: true           (普通工作日)
Sat 2026-07-25 isWorkDay: false          (周末)
2026-02-17 holiday isWorkDay: false      (法定节假日)
2026-02-28 workday  isWorkDay: true      (调休)
overlap Sat 2026-07-25 isWorkDay: false  (重叠 → HOLIDAYS 优先)

09:30 → true   (早 9 点半上班)
08:30 → false  (上班前)
18:00 → false  (下班点)
12:00 → false  (午休开始)
12:30 → false  (午休中段)
12:59 → false  (午休接近结束)
13:00 → true   (午休结束)
11:59 → true   (午休前一刻)
17:30 → true   (午休外下班前)

monthKey(2026-07-28) = 2026-07
monthKey(2026-07-31) = 2026-07   (月末不跨)
monthKey(2026-08-01) = 2026-08   (跨月命中)
```

### 4. 推荐手工验证（VSCode 扩展）

1. 默认配置加载面板：可见数字滚动 + 日薪/时薪/剩余天数副指标
2. 改 `salaryClock.decimalPlaces=2`：金额同步显示 2 位
3. 改 `salaryClock.decimalPlaces=0`：只显示整数
4. 在 devtools 跨过午夜（`Date.now = ...`）：第二天数字接着长，副指标无变化
5. 跨月（`Date.now` 调到下月 1 日）：副指标立即刷新到新月，时薪/剩余工作日重新算
6. 调到周末/午休时段：显示倒计时与激励语，DOM 写入频率肉眼可感到降低

---

## 严禁事项自检

- ✓ 未改 `src/`
- ✓ 未新增 `*.test.ts`
- ✓ 只动 `web/index.html`
- ✓ 未动 `index.html` 之外的 `web/` 资源
- ✓ 未碰 `package.json`

---

## 已知未修复（明确留给其他 worktree）

- `always` 模式 `hours = dim * getWorkHours()`（review-code-quality P0）：由 fix-backend / salary-core 修复，本任务保留原行为
- 非法时间字符串（`'abc'`）仍会让 `parseTime` 返回 NaN —— `parseTimeSafe` 已提供但本任务内未替换 `parseTime` 调用，留给 fix-backend 同步
- 数据过期告警（2027+）由 fix-backend 处理

---

## 文件变更摘要

```
 web/index.html | 299 +++++++++++++++++++++++++++++++++++++++++++--------------
 1 file changed, 226 insertions(+), 73 deletions(-)
```
