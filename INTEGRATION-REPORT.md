# 集成报告：fix-tooling → fix-backend

分支：`fix/backend-review`

将 `fix-tooling`（ESLint + 数据外置 JSON + 单元测试 + 工具链）的非冲突改动，
合并进 `fix-backend`（src/ 端 P0/P1 修复 + 零依赖计算核心重构）。冲突文件
`src/salary-core.ts` 以 **fix-backend 版本为基线**（保留全部 P0/P1 修复），再把
fix-tooling 的数据外置 / 测试所需 API 附加进来。

## 一、改动文件清单

### 新增（来自 fix-tooling）
| 文件 | 说明 |
| --- | --- |
| `src/data/holidays.json` | 2024–2026 法定节假日，按年分组 |
| `src/data/workdays.json` | 2024–2026 调休上班，按年分组 |
| `src/salary-core.test.ts` | node:test 单元测试，65 例 |
| `.eslintrc.cjs` | ESLint 8 Legacy 配置（TS recommended） |
| `package.nls.json` | i18n 占位（`{}`） |
| `INTEGRATION-REPORT.md` | 本报告 |

### 修改
| 文件 | 改动 |
| --- | --- |
| `src/salary-core.ts` | 节假日数据由硬编码常量改为 `import ... from './data/*.json'` 展平；新增 `DayMark` / `WorkDayResult` 类型、`COVERED_YEARS`、`hasHolidayData()`；保留 `getCoveredYears()`（extension.ts 依赖）；`calcEarned` / `calcMonthWorkDays` 增加可注入的 `isWorkDayFn` 参数（默认 `isWorkDay`，不破坏既有调用）；`parseTime` 支持首尾空白 trim；`isWorkingTime` 不再扣午休、`formatMoney` 的 NaN 位数回退改为 0（对齐测试语义，均不影响 `calcEarned` 金额正确性） |
| `src/salary.ts` | 无需改动：已 `export * from './salary-core'`，`getConfig` 仍从 `vscode.workspace.getConfiguration` 读取并 clamp，接口对 extension.ts / webview 保持不变 |
| `tsconfig.json` | 新增 `"resolveJsonModule": true`（JSON 数据导入所需） |
| `package.json` | 合并 devDependencies（eslint / @typescript-eslint/* / tsx）与 scripts（`lint` 改 `--ext .ts`、新增 `test`）；`updateIntervalMs` 默认值保留 fix-backend 的 **250** |
| `package-lock.json` | `npm install` 重新生成 |
| `README.md` | 顶部加入 i18n 提醒行 |

### 删除
- `FIX-BACKEND.md`、`FIX-TOOLING.md`：中间过程报告，合并完成后清理。

## 二、冲突处理决策

- **`src/salary-core.ts`**：取 fix-backend 版（含全部 P0/P1 修复 +
  `workedMinutesSoFar`/`isWorkingMinute` 单一午休边界来源 + `getCoveredYears()`），
  再嫁接 fix-tooling 的「数据外置 + 测试所需 API」。
- **数据展平**：`Object.assign({}, ...Object.values(data))`，等价于 fix-tooling 的
  `flatten`，把 `{ "2026": { "2026-01-01": {...} } }` 展平为扁平字典。
- **`updateIntervalMs` 默认值**：按要求取 fix-backend 的 250。
- **两处测试语义对齐**（原 fix-backend 与 fix-tooling 测试预期不一致，测试为验收基线）：
  1. `isWorkingTime` 改为「不扣午休」（午休期间仍属工作时段，仅影响状态栏图标）；
  2. `formatMoney(amount, NaN)` 的小数位回退由 4 改为 0。
  两者都不影响 `calcEarned` 的金额计算（`calcEarned` 仍用 `workedMinutesSoFar`
  正确扣除午休）。

## 三、验证结果

命令均在集成后于 `fix-backend` 工作区执行：

```
$ npm run compile   # tsc -p ./
exit 0

$ npm run lint      # eslint src --ext .ts
exit 0

$ npm run test      # node --import tsx --test "src/**/*.test.ts"
ℹ tests 65
ℹ suites 9
ℹ pass 65
ℹ fail 0
exit 0
```

## 四、结论

集成成功：数据外置（JSON）、ESLint、node:test 65 例、工具链均已合入 fix-backend，
且保留全部 src/ 端 P0/P1 修复。`compile / lint / test` 三项全部通过。
按用户偏好**未 push**。
