/**
 * salary-core 单元测试（node:test，零外部依赖）
 *
 * 运行：npm run test  →  node --import tsx --test src/salary-core.test.ts
 * 覆盖 review-ux-errors-testing.md《缺失测试用例清单》全部条目。
 *
 * 说明：为让工作日相关分支可控且确定，calcEarned/calcMonthWorkDays 支持注入
 * isWorkDayFn。默认（不注入）时使用内置节假日数据，另有独立用例覆盖真实数据。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseTime,
  isWorkDay,
  isWorkingTime,
  getWorkHours,
  calcEarned,
  calcMonthWorkDays,
  formatMoney,
  hasHolidayData,
  mergeDayMarks,
  HOLIDAYS,
  WORKDAYS,
  type SalaryConfig,
  type WorkDayResult,
} from './salary-core';

// ---------- 测试工具 ----------

const EPS = 1e-6;
function approx(actual: number, expected: number, eps = EPS): void {
  assert.ok(
    Math.abs(actual - expected) < eps,
    `期望 ≈ ${expected}，实际 ${actual}（差 ${Math.abs(actual - expected)}）`,
  );
}

/** 基准配置：10:30–18:30，午休 2h@12:00，工时 6h */
function baseWork(overrides: Partial<SalaryConfig> = {}): SalaryConfig {
  return {
    monthlySalary: 20000,
    startTime: '10:30',
    endTime: '18:30',
    lunchDurationMin: 120,
    lunchStart: '12:00',
    mode: 'work',
    decimalPlaces: 4,
    ...overrides,
  };
}

const allTrue = (): WorkDayResult => true;
// 2026 年 7 月：无节假日/调休，dim=31。工时 6h，allTrue → 当月总工时 = 31*6 = 186。
const HR = 20000 / 186; // 时薪 = 月薪 / 总工时(allTrue: 31*6h)
const DAILY = 20000 / 31; // 每个整工作日金额 = HR*6

// ==================== parseTime ====================

describe('parseTime', () => {
  it('合法 "09:00" → 540', () => assert.equal(parseTime('09:00'), 540));
  it('"00:00" → 0', () => assert.equal(parseTime('00:00'), 0));
  it('"23:59" → 1439', () => assert.equal(parseTime('23:59'), 1439));
  it('首尾空白 " 09:00 " 支持 trim → 540', () => assert.equal(parseTime(' 09:00 '), 540));
  it('"abc:def" → null', () => assert.equal(parseTime('abc:def'), null));
  it('"25:99" 越界 → null', () => assert.equal(parseTime('25:99'), null));
  it('"24:00" 小时越界 → null', () => assert.equal(parseTime('24:00'), null));
  it('"12:60" 分钟越界 → null', () => assert.equal(parseTime('12:60'), null));
  it('空串 "" → null', () => assert.equal(parseTime(''), null));
  it('无冒号 "9" → null', () => assert.equal(parseTime('9'), null));
  it('非字符串 → null', () => assert.equal(parseTime(null as unknown as string), null));
});

// ==================== isWorkDay ====================

describe('isWorkDay', () => {
  it('普通工作日（周一 2026-07-06）→ true', () =>
    assert.equal(isWorkDay(new Date(2026, 6, 6)), true));
  it('周六 2026-07-11 → false', () => assert.equal(isWorkDay(new Date(2026, 6, 11)), false));
  it('周日 2026-07-12 → false', () => assert.equal(isWorkDay(new Date(2026, 6, 12)), false));
  it('法定节假日 2026-02-17 春节 → false', () =>
    assert.equal(isWorkDay(new Date(2026, 1, 17)), false));
  it('调休上班 2026-02-14（周六）→ true', () =>
    assert.equal(isWorkDay(new Date(2026, 1, 14)), true));
  it('跨年边界 2026-12-31（周四）→ true', () =>
    assert.equal(isWorkDay(new Date(2026, 11, 31)), true));
  it('数据过期 2027-01-01（周五，本应元旦）退化为普通工作日 → true', () =>
    assert.equal(isWorkDay(new Date(2027, 0, 1)), true));
  it('hasHolidayData：2026 有、2027 无', () => {
    assert.equal(hasHolidayData(2026), true);
    assert.equal(hasHolidayData(2027), false);
  });
  it('数据加载：HOLIDAYS/WORKDAYS 非空且含已知键', () => {
    assert.ok(Object.keys(HOLIDAYS).length > 0);
    assert.ok(Object.keys(WORKDAYS).length > 0);
    assert.deepEqual(HOLIDAYS['2026-02-17'], { name: '春节' });
    assert.deepEqual(WORKDAYS['2026-02-14'], { name: '春节调休' });
  });
});

// ==================== isWorkingTime ====================

describe('isWorkingTime', () => {
  const c = baseWork();
  it('==start（10:30）→ true（含）', () =>
    assert.equal(isWorkingTime(c, new Date(2026, 6, 6, 10, 30)), true));
  it('==end（18:30）→ false（不含）', () =>
    assert.equal(isWorkingTime(c, new Date(2026, 6, 6, 18, 30)), false));
  it('区间内（14:00）→ true', () =>
    assert.equal(isWorkingTime(c, new Date(2026, 6, 6, 14, 0)), true));
  it('区间外（10:29）→ false', () =>
    assert.equal(isWorkingTime(c, new Date(2026, 6, 6, 10, 29)), false));
  it('午休时段仍算工作时间（isWorkingTime 不看午休）→ true', () =>
    assert.equal(isWorkingTime(c, new Date(2026, 6, 6, 12, 30)), true));
  it('always 模式恒为 true（周末凌晨）', () =>
    assert.equal(isWorkingTime(baseWork({ mode: 'always' }), new Date(2026, 6, 11, 3, 0)), true));
  it('休息日（周六）work 模式恒为 false', () =>
    assert.equal(isWorkingTime(c, new Date(2026, 6, 11, 14, 0)), false));
  it('非法时间配置 → false', () =>
    assert.equal(isWorkingTime(baseWork({ startTime: 'bad' }), new Date(2026, 6, 6, 14, 0)), false));
});

// ==================== getWorkHours ====================

describe('getWorkHours', () => {
  it('正常 10:30–18:30 午休2h → 6', () => approx(getWorkHours(baseWork()), 6));
  it('午休=0 → 8', () => approx(getWorkHours(baseWork({ lunchDurationMin: 0 })), 8));
  it('午休>工时（600min）→ 负工时 -2', () =>
    approx(getWorkHours(baseWork({ lunchDurationMin: 600 })), -2));
  it('startTime>endTime → 负工时 -10', () =>
    approx(getWorkHours(baseWork({ startTime: '18:30', endTime: '10:30' })), -10)); // (630-1110-120)/60
  it('非法时间 → NaN', () =>
    assert.ok(Number.isNaN(getWorkHours(baseWork({ startTime: 'xx:yy' })))));
});

// ==================== calcEarned —— work 模式 ====================

describe('calcEarned (work)', () => {
  it('上班前（10:00）：仅累计昨日，今日 0 增量', () => {
    const earned = calcEarned(baseWork(), new Date(2026, 6, 15, 10, 0, 0), allTrue);
    approx(earned, 14 * DAILY); // 1..14 号共 14 个整工作日
  });

  it('工作时段中（17:00）：昨日累计 + 今日 4.5 小时（午休后 14:00–17:00）', () => {
    const earned = calcEarned(baseWork(), new Date(2026, 6, 15, 17, 0, 0), allTrue);
    approx(earned, 14 * DAILY + HR * 4.5);
  });

  it('午休不增长：12:00 / 13:00 / 14:00 中前两个一致（均为 1.5h）', () => {
    const c = baseWork();
    const at1200 = calcEarned(c, new Date(2026, 6, 15, 12, 0, 0), allTrue);
    const at1300 = calcEarned(c, new Date(2026, 6, 15, 13, 0, 0), allTrue);
    const at1400 = calcEarned(c, new Date(2026, 6, 15, 14, 0, 0), allTrue);
    approx(at1200, 14 * DAILY + HR * 1.5);
    approx(at1300, at1200);   // 午休期间不增长
    approx(at1400, at1200);   // 午休结束那一刻也不增长
  });

  it('下班后（20:00）：今日封顶为满额', () => {
    const earned = calcEarned(baseWork(), new Date(2026, 6, 15, 20, 0, 0), allTrue);
    approx(earned, 15 * DAILY);
  });

  it('深夜（23:59）与刚下班（18:30）同值（封顶不溢出）', () => {
    const a = calcEarned(baseWork(), new Date(2026, 6, 15, 18, 30, 0), allTrue);
    const b = calcEarned(baseWork(), new Date(2026, 6, 15, 23, 59, 59), allTrue);
    approx(a, 15 * DAILY);
    approx(b, 15 * DAILY);
  });

  it('半天（today=half）：今日增量为整日的一半', () => {
    const halfToday = (d: Date): WorkDayResult => (d.getDate() === 15 ? 'half' : true);
    const before = calcEarned(baseWork(), new Date(2026, 6, 15, 10, 0, 0), halfToday);
    const after = calcEarned(baseWork(), new Date(2026, 6, 15, 20, 0, 0), halfToday);
    const hr183 = 20000 / 183; // 30 整日×6 + 1 半日×3 = 183
    approx(after - before, hr183 * 6 * 0.5); // 半天封顶 = 时薪 * 工时 * 0.5
  });

  it('月初 1 日下班后：仅今日满额', () => {
    const earned = calcEarned(baseWork(), new Date(2026, 6, 1, 20, 0, 0), allTrue);
    approx(earned, 1 * DAILY);
  });

  it('月末 31 日下班后：全月累计 ≈ 月薪 20000', () => {
    const earned = calcEarned(baseWork(), new Date(2026, 6, 31, 20, 0, 0), allTrue);
    approx(earned, 20000, 1e-4);
  });
});

// ==================== calcEarned —— always 模式 ====================

describe('calcEarned (always)', () => {
  const c = baseWork({ mode: 'always' });

  it('月初 0 点 → 0', () => {
    approx(calcEarned(c, new Date(2026, 6, 1, 0, 0, 0)), 0);
  });

  it('月中（7-16 12:00，恰好半月）→ 月薪的一半 10000', () => {
    approx(calcEarned(c, new Date(2026, 6, 16, 12, 0, 0)), 10000);
  });

  it('月末（7-31 23:59:59）→ 接近但不超过月薪', () => {
    const earned = calcEarned(c, new Date(2026, 6, 31, 23, 59, 59));
    assert.ok(earned > 19999 && earned <= 20000, `实际 ${earned}`);
  });

  it('独立于工作时间：正常时间与非法/颠倒时间结果一致', () => {
    const now = new Date(2026, 6, 16, 12, 0, 0);
    const normal = calcEarned(baseWork({ mode: 'always' }), now);
    const reversed = calcEarned(baseWork({ mode: 'always', startTime: '18:00', endTime: '09:00' }), now);
    const garbage = calcEarned(baseWork({ mode: 'always', startTime: 'x', endTime: 'y' }), now);
    approx(normal, 10000);
    approx(reversed, 10000);
    approx(garbage, 10000);
  });
});

// ==================== calcEarned —— 稳健性边界 ====================

describe('calcEarned (边界/稳健性)', () => {
  const now = new Date(2026, 6, 15, 12, 0, 0);
  it('monthlySalary=0 → 0', () =>
    assert.equal(calcEarned(baseWork({ monthlySalary: 0 }), now, allTrue), 0));
  it('monthlySalary 负数 → 0', () =>
    assert.equal(calcEarned(baseWork({ monthlySalary: -5000 }), now, allTrue), 0));
  it('monthlySalary=NaN → 0', () =>
    assert.equal(calcEarned(baseWork({ monthlySalary: NaN }), now, allTrue), 0));
  it('monthlySalary=字符串 "abc" → 0（不产生 NaN）', () =>
    assert.equal(
      calcEarned(baseWork({ monthlySalary: 'abc' as unknown as number }), now, allTrue),
      0,
    ));
  it('startTime>endTime（工时为负）→ 0', () =>
    assert.equal(
      calcEarned(baseWork({ startTime: '18:00', endTime: '09:00' }), now, allTrue),
      0,
    ));
  it('午休>工时（工时为负）→ 0', () =>
    assert.equal(calcEarned(baseWork({ lunchDurationMin: 600 }), now, allTrue), 0));
  it('非法时间配置 → 0（不产生 NaN）', () =>
    assert.equal(calcEarned(baseWork({ startTime: 'bad' }), now, allTrue), 0));
  it('always 模式下 monthlySalary=NaN → 0', () =>
    assert.equal(calcEarned(baseWork({ mode: 'always', monthlySalary: NaN }), now), 0));
});

// ==================== formatMoney ====================

describe('formatMoney', () => {
  it('正常 4 位', () => assert.equal(formatMoney(123.456789, 4), '¥ 123.4568'));
  it('NaN → "¥ —"', () => assert.equal(formatMoney(NaN, 4), '¥ —'));
  it('Infinity → "¥ —"', () => assert.equal(formatMoney(Infinity, 4), '¥ —'));
  it('decimalPlaces=0', () => assert.equal(formatMoney(5, 0), '¥ 5'));
  it('decimalPlaces=6', () => assert.equal(formatMoney(1, 6), '¥ 1.000000'));
  it('越界负数 clamp 到 0', () => assert.equal(formatMoney(100, -3), '¥ 100'));
  it('越界 >6 clamp 到 6', () => assert.equal(formatMoney(100, 10), '¥ 100.000000'));
  it('decimalPlaces=NaN → 视为 0', () => assert.equal(formatMoney(100, NaN), '¥ 100'));
});

// ==================== calcMonthWorkDays ====================

describe('calcMonthWorkDays', () => {
  it('always 模式也按工作日统计（仅薪资计算不同，工时统计不变）2026-07 → 23 / 184', () => {
    const r = calcMonthWorkDays(baseWork({ mode: 'always' }), 2026, 6);
    assert.equal(r.days, 23);
    assert.equal(r.hours, 138);
  });
  it('always 模式 2 月也按工作日统计（含春节放假）', () => {
    const r = calcMonthWorkDays(baseWork({ mode: 'always' }), 2026, 1);
    assert.equal(r.days, 16);
    assert.equal(r.hours, 96);
  });
  it('work + allTrue stub → days=31, hours=186', () => {
    const r = calcMonthWorkDays(baseWork(), 2026, 6, allTrue);
    assert.equal(r.days, 31);
    approx(r.hours, 186);
  });
  it('work + 真实数据（2026-07 无节假日）→ hours === days*6 且 days>20', () => {
    const r = calcMonthWorkDays(baseWork(), 2026, 6);
    approx(r.hours, r.days * 6);
    assert.ok(r.days > 20 && r.days < 24, `实际 days=${r.days}`);
  });
});

// ==================== 用户自定义节假日/调休（settings 合并） ====================

describe('mergeDayMarks（用户配置覆盖内置）', () => {
  it('无用户配置 → 返回内置拷贝', () => {
    const merged = mergeDayMarks({ '2026-01-01': { name: '元旦' } }, undefined);
    assert.deepEqual(merged, { '2026-01-01': { name: '元旦' } });
  });
  it('用户配置为空数组 → 返回内置拷贝', () => {
    const merged = mergeDayMarks({ '2026-01-01': { name: '元旦' } }, []);
    assert.deepEqual(merged, { '2026-01-01': { name: '元旦' } });
  });
  it('name 为纯空格 → 跳过', () => {
    const merged = mergeDayMarks(
      {},
      [{ date: '2027-01-01', name: '   ' }, { date: '2027-01-02', name: '\t\n' }],
    );
    assert.equal(Object.keys(merged).length, 0);
  });
  it('name 带前后空格 → 保留并 trim', () => {
    const merged = mergeDayMarks({}, [{ date: '2027-01-01', name: '  元旦  ' }]);
    assert.equal(merged['2027-01-01']?.name, '元旦');
  });
  it('用户新增内置不存在的日期 → 合并', () => {
    const merged = mergeDayMarks(
      { '2026-01-01': { name: '元旦' } },
      [{ date: '2027-01-01', name: '元旦（自定义）' }],
    );
    assert.equal(merged['2026-01-01']?.name, '元旦');
    assert.equal(merged['2027-01-01']?.name, '元旦（自定义）');
  });
  it('用户配置与内置同日 → 用户覆盖', () => {
    const merged = mergeDayMarks(
      { '2026-02-17': { name: '春节' } },
      [{ date: '2026-02-17', name: '春节（自定）' }],
    );
    assert.equal(merged['2026-02-17']?.name, '春节（自定）');
  });
  it('非法日期格式 → 静默跳过', () => {
    const merged = mergeDayMarks(
      {},
      [
        { date: 'abc', name: '乱码' },
        { date: '2027/01/01', name: '斜杠分隔' },
        { date: '2027-1-1', name: '无前导零' },
        { date: '', name: '空串' },
        { date: '20260101', name: '无连字符' },
      ],
    );
    assert.equal(Object.keys(merged).length, 0);
  });
  it('缺 name 或 name 为空 → 跳过', () => {
    const merged = mergeDayMarks(
      {},
      [
        { date: '2027-01-01', name: '' },
        // @ts-expect-error 测试缺字段
        { date: '2027-01-02' },
      ],
    );
    assert.equal(Object.keys(merged).length, 0);
  });
  it('非数组输入 → 当作空配置', () => {
    // @ts-expect-error 测试坏数据
    assert.equal(Object.keys(mergeDayMarks({ a: { name: 'x' } }, null)).length, 1);
    // @ts-expect-error 测试坏数据
    assert.equal(Object.keys(mergeDayMarks({}, 'not array')).length, 0);
  });
});

describe('workdays 接入 + workdayAdjustment 开关（节假日固定不可编辑）', () => {
  it('isWorkDay 用 config.workdays 把周六标为上班', () => {
    // 2026-07-04 是周六（休息日）
    const sat = new Date(2026, 6, 4);
    assert.equal(isWorkDay(sat), false, '基线：周六默认休息');
    const custom: SalaryConfig['workdays'] = { ...WORKDAYS, '2026-07-04': { name: '公司调休' } };
    assert.equal(isWorkDay(sat, HOLIDAYS, custom), true, '用户配置后：周六变上班');
  });
  it('workdayAdjustment=false → 调休表全部失效（外企/弹性工作制场景）', () => {
    const sat = new Date(2026, 6, 4);
    const withWorkday: SalaryConfig['workdays'] = { ...WORKDAYS, '2026-07-04': { name: '公司调休' } };
    // 启用调休：周六变上班
    assert.equal(isWorkDay(sat, HOLIDAYS, withWorkday, true), true, '启用调休 → 周六上班');
    // 关掉调休：周六回到默认休息
    assert.equal(isWorkDay(sat, HOLIDAYS, withWorkday, false), false, '禁用调休 → 周六休息');
  });
  it('workdayAdjustment 默认 true（不传第 4 参 = 启用调休，向后兼容）', () => {
    const sat = new Date(2026, 6, 4);
    const withWorkday: SalaryConfig['workdays'] = { ...WORKDAYS, '2026-07-04': { name: '公司调休' } };
    // 不传 workdayAdjustment 时 = true（向后兼容）
    assert.equal(isWorkDay(sat, HOLIDAYS, withWorkday), true, '默认启用调休 → 周六上班');
  });
  it('workdayAdjustment=false 时，调休日不计入月总工时（影响时薪分母）', () => {
    // 把 2026-07-04 周六加入用户调休
    const enabledConfig = baseWork({
      workdays: { ...WORKDAYS, '2026-07-04': { name: '公司调休' } },
      workdayAdjustment: true,
    });
    const disabledConfig = baseWork({
      workdays: { ...WORKDAYS, '2026-07-04': { name: '公司调休' } },
      workdayAdjustment: false,
    });
    // 启用：月 work days = 23 (weekday) + 1 (07-04) = 24
    // 禁用：月 work days = 23（07-04 当周末处理）
    // 时薪分母不同 → calcMonthWorkDays 结果应不同
    const rEnabled = calcMonthWorkDays(enabledConfig, 2026, 6);
    const rDisabled = calcMonthWorkDays(disabledConfig, 2026, 6);
    assert.equal(rEnabled.days, 24, '启用调休：24 个工作日');
    assert.equal(rDisabled.days, 23, '禁用调休：23 个工作日（07-04 视为周末）');
    assert.equal(rEnabled.hours, 24 * 6);
    assert.equal(rDisabled.hours, 23 * 6);
  });
  it('同日同时出现在 HOLIDAYS 和 workdays → 节假日永远优先', () => {
    const both: SalaryConfig['workdays'] = { ...WORKDAYS, '2026-02-17': { name: '冲突的调休' } };
    const d = new Date(2026, 1, 17); // 2026-02-17 是春节（内置节假日）
    assert.equal(isWorkDay(d, HOLIDAYS, both), false, '节假日胜出，调休被忽略');
  });
  it('calcEarned 用 config.workdays：周末标为调休后，real 与 stub（全 work）数额有差异', () => {
    // 把 2026-07-04 周六标为调休上班
    const config = baseWork({
      workdays: { ...WORKDAYS, '2026-07-04': { name: '公司调休' } },
    });
    const stub = (_d: Date) => true;  // 全 work → 月 31 天
    const stubEarned = calcEarned(config, new Date(2026, 6, 6, 18, 0), stub);
    const realEarned = calcEarned(config, new Date(2026, 6, 6, 18, 0));
    // 实测：stub=3870 (31 天分母时薪低但累加多天) real=4166 (24 天分母时薪高但少 1 周末)
    // 关键断言：real != stub（说明 config.workdays 实际影响了计算）
    assert.notEqual(realEarned, stubEarned,
      `合并 workdays 后应影响计算结果：real(${realEarned}) vs stub(${stubEarned})`);
    // 时薪 real 比 stub 高：realHourly = 20000/192 = 104.17; stubHourly = 20000/248 = 80.65
    // 差距 ≈ 23.5 元/小时
    assert.ok(realEarned > stubEarned,
      `real 时薪应更高（分母更小）：real=${realEarned} stub=${stubEarned}`);
  });
});
