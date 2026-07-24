# CSS 学习指南（以「哄我上班」项目为教材）

> 本指南以项目根目录的 `index.html` 为真实教材，所有知识点都标注了对应行号，建议一边读文档、一边对照源码、一边在浏览器 DevTools 里动手改。

---

## 目录

1. [项目的 CSS 结构地图](#一项目的-css-结构地图)
2. [由浅入深学习路线](#二由浅入深学习路线)
   - 第 1 步：CSS 是什么 & 选择器
   - 第 2 步：盒模型
   - 第 3 步：颜色、字体与单位
   - 第 4 步：Flexbox 弹性布局
   - 第 5 步：Grid 网格布局
   - 第 6 步：定位 position
   - 第 7 步：渐变与背景
   - 第 8 步：CSS 变量与主题系统 ⭐
   - 第 9 步：过渡与动画
   - 第 10 步：响应式与移动端细节
   - 第 11 步：进阶调味料
3. [推荐学习节奏](#三推荐学习节奏)
4. [如何用 Figma 做 CSS 设计](#四如何用-figma-做-css-设计)

---

## 一、项目的 CSS 结构地图

项目的所有 CSS 都写在 `index.html` 的 `<style>` 标签内（第 18–884 行），没有外部样式表，对初学者非常友好。整体组织如下：

| 行号 | 内容 |
|---|---|
| 19 | 全局重置 |
| 30–65 | 默认主题（aurora）的 CSS 变量 |
| 94–330 | 7 套额外主题的变量覆盖（cyber / warm / ocean / mono / forest / ledger / arcade） |
| 332 起 | 布局与组件样式（卡片、按钮、日历、时钟……） |
| 568 起 | 背景装饰与各主题专属特效 |
| 813–852 | 全部 `@keyframes` 动画定义 |
| 854–883 | 无障碍与响应式媒体查询 |

---

## 二、由浅入深学习路线

### 第 1 步：CSS 是什么 & 选择器（地基）

CSS 的本质就两件事：**选中元素 → 给它贴属性**。选择器从简单到复杂，项目里全部都有：

```css
body { ... }                  /* 元素选择器：选中所有 <body> */
.card { ... }                 /* 类选择器：选中 class="card"，项目里用得最多 */
#clockView { ... }            /* ID 选择器：选中 id="clockView"，全页面唯一 */
.theme-card[data-theme="cyber"] { ... }  /* 属性选择器（第 370 行） */
.theme-card:hover { ... }     /* 伪类：鼠标悬停时（第 406 行） */
.day:hover:not(.empty) { ... }/* 组合：悬停且不是 .empty（第 478 行） */
.day.today { ... }            /* 同时具有 day 和 today 两个类（第 479 行） */
body.theme-cyber .card { ... }/* 后代选择器：.theme-cyber 里面的 .card（第 325 行） */
```

**动手练习**：浏览器打开 `index.html`，按 F12 打开 DevTools，点左上角的小箭头「点选」页面元素，右侧 Styles 面板会实时显示它命中的每一条 CSS 规则。试着勾选/取消某个属性，页面立刻变化——这是最快的学习方式。

### 第 2 步：盒模型（每个元素都是一个盒子）

每个 HTML 元素都是一个盒子，从里到外：`content → padding → border → margin`。第 19 行是几乎所有网页的标准开头：

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
```

- `margin: 0; padding: 0;`：清掉浏览器默认间距，一切从零开始。
- `box-sizing: border-box`：**极其重要**——让 `width` 包含 padding 和 border，元素说多宽就多宽，不会被撑大。

对照第 424–428 行的 `.card`，说出它的完整盒模型：`padding: 18px`（内边距）、`border: 1px solid`（边框）、`margin-bottom: 14px`（外边距）。

### 第 3 步：颜色、字体与单位

**颜色的写法**（项目里都有）：

- 十六进制：`#101422`（第 31 行）
- 带透明度：`rgba(255,255,255,0.09)`（第 36 行，最后的 0.09 是透明度）
- 渐变：见第 7 步

**单位对照表**（均为项目真实例子）：

| 单位 | 含义 | 项目例子 |
|---|---|---|
| `px` | 固定像素 | `padding: 18px` |
| `rem` | 相对根元素字号（默认 1rem = 16px） | `font-size: 5rem`（第 532 行，大金额数字） |
| `vh` / `vw` | 视口高 / 宽的 1% | `height: 100vh`（第 335 行，撑满整屏） |
| `%` | 相对父元素 | `width: 100%` |
| `fr` | Grid 里的「份数」 | 见第 5 步 |

字体注意第 48 行的 `font-family` 是一条**回退链**：浏览器从左往右找，第一个系统里存在的字体就生效，所以中文系统会落到「苹方 / 微软雅黑」。

### 第 4 步：Flexbox 弹性布局（一维排列）

Flex 解决「一行 / 一列里几个元素怎么排」。看第 341–346 行 `#clockView`：

```css
#clockView {
    display: flex;            /* 开启弹性布局 */
    flex-direction: column;   /* 主轴改为竖直方向 */
    align-items: center;      /* 交叉轴（水平）居中 */
    justify-content: center;  /* 主轴（竖直）居中 */
}
```

四行代码实现「内容在屏幕正中央」——这在 Flex 出现之前是 CSS 的著名难题。再看第 463 行 `.calendar-header` 的 `justify-content: space-between`，即「标题靠左、按钮靠右」的经典写法。

**口诀**：`display: flex` 写在**父元素**上，管的是**子元素**的排列；`justify-content` 管主轴，`align-items` 管交叉轴。

### 第 5 步：Grid 网格布局（二维表格）

Grid 解决「多行多列怎么排」。最漂亮的例子是第 357 行的主题选择器：

```css
.theme-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 8px; }
```

含义：8 列，每列占 1 份（`fr`），格子间距 8px。日历是 `repeat(7, 1fr)`（第 471 行，一周 7 天），时间选择是 `repeat(4, 1fr)`（第 441 行）。再看第 876–882 行的响应式：屏幕小于 480px 时主题网格变 4 列——**改一个数字，整个网格自动重排**，这就是 Grid 的威力。

另外第 359 行的 `aspect-ratio: 1` 让每个格子永远是正方形，不管屏幕多宽。

### 第 6 步：定位 position（把元素钉在想要的地方）

四种定位，项目全部用到：

- `position: relative`：不移动，但成为后代 absolute 元素的「参照物」（第 83 行 body）。
- `position: absolute`：相对最近的 positioned 祖先定位，脱离文档流。例如日历格子上「上午休 / 下午休」的小圆点（第 491–495 行），绝对定位在格子的左下 / 右下角。
- `position: fixed`：相对**浏览器窗口**定位，滚动也不动。第 543–548 行的 `.back-btn`：`bottom: 14px; left: 50%; transform: translateX(-50%)` 是「固定在屏幕底部居中」的经典三连。
- `z-index`：控制层叠顺序，`.modal-overlay` 用 `z-index: 100` 压在所有内容之上（第 641–645 行）。

### 第 7 步：渐变与背景（本项目的灵魂）

这个项目的美感 90% 来自渐变。三种渐变全部用到：

```css
/* 线性渐变：沿 140° 方向多段颜色过渡（第 32 行） */
--bg-gradient: linear-gradient(140deg, #101422 0%, #221947 34%, #0c3b45 68%, #121928 100%);

/* 重复线性渐变：画出扫描线 / 条纹（第 98 行） */
--decor: repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 5px);

/* 重复径向渐变：画出水波纹同心圆（第 164 行） */
--decor: repeating-radial-gradient(circle at 50% 52%, transparent 0 56px, rgba(54,226,255,0.12) 57px 58px, transparent 59px 116px);
```

关键技巧：**颜色后面跟位置**（如 `0 21%`）。同一位置颜色突变就是「硬边」，不同位置就是「平滑过渡」。用硬边 + 重复渐变，纯 CSS 就能画出网格、条纹、同心圆，不需要任何图片。`background-size`（如第 34 行 `220px 220px`）控制一块图案的平铺大小。

**动手练习**：把第 32 行的角度 `140deg` 改成 `45deg`，刷新页面，整个背景的方向就变了。

### 第 8 步：CSS 自定义属性（变量）与主题系统 ⭐

这是本项目**最值得学的设计模式**，也是现代 CSS 的核心。看第 30–65 行：

```css
:root {
    --primary: #75f0cf;        /* 定义变量 */
    --card: rgba(255,255,255,0.09);
}
.card {
    background: var(--card);   /* 使用变量 */
    border: 1px solid var(--card-border);
}
```

然后第 94 行：

```css
html.theme-cyber { --primary: #00ff9d; --card: rgba(0,255,157,0.08); ... }
```

JS 切换主题时只需给 `<body>` 换 class（如 `theme-cyber`），**所有变量整体换值，全页面几百处 `var(--primary)` 瞬间变色**，具体样式一行都不用改。这就是「设计令牌（Design Token）」思想：先定义语义化变量（主色、卡片色、文字色），组件只引用变量，不写死颜色。

**动手练习（强烈建议）**：复制第 128–159 行的 `theme-warm` 整段，改名 `theme-sakura`，把颜色换成粉色系，就是一套全新主题。这是理解变量最好的练习。

### 第 9 步：过渡 transition 与动画 @keyframes

**transition**（第 363 行）：属性变化时「慢慢变」，而不是瞬间跳变：

```css
.theme-card { transition: all 0.2s; }
.theme-card:hover { transform: scale(1.05); }  /* 悬停放大 5%，0.2 秒平滑完成 */
```

**@keyframes 动画**：自定义关键帧，自动循环。第 563 行的入场动画：

```css
@keyframes fadeIn { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
.countdown-box { animation: fadeIn 0.5s ease; }
```

`animation` 完整语法为「动画名 时长 缓动函数 次数」，如第 368 行 `swatchShine 4.8s ease-in-out infinite` 表示无限循环。第 404 行的 `steps(6,end)` 是进阶技巧——不做平滑过渡而是「跳帧」，用来制造像素游戏的卡顿感。

第 813–852 行有 40 个 keyframes 定义，建议挑 3 个（`scanlines`、`sonarPing`、`pixelDrop`）逐行读懂，动画就算过关。

### 第 10 步：响应式与移动端细节

- `@media (max-width: 480px)`（第 876 行）：小屏幕下的覆盖规则，移动端适配的标准做法。
- `env(safe-area-inset-top)`（第 336 行）：避开 iPhone 刘海的安全区域。
- `100dvh` / `100lvh`（第 63、76 行）：解决手机浏览器地址栏伸缩导致的视口高度跳动问题。
- `@media (prefers-reduced-motion: reduce)`（第 854 行）：用户系统开启「减少动态效果」时停掉所有动画——无障碍（a11y）的好习惯。

### 第 11 步：进阶调味料（知道在哪查即可）

- `backdrop-filter: blur(12px)`（第 426 行）：毛玻璃效果，卡片背后的景色被模糊。
- `filter: blur(30px)` + 渐变（第 520–529 行）：时钟数字背后的「光晕」，是一个被重度模糊的渐变伪元素。
- `font-variant-numeric: tabular-nums`（第 435 行）：数字等宽，金额跳动时不左右晃动。
- `box-shadow` 多层叠加（第 47 行）：多个阴影用逗号分隔，叠出霓虹光效。
- `::before` / `::after` 伪元素（遍布全文，如第 365、520 行）：不增加 HTML 标签，纯 CSS 添加装饰层。

---

## 三、推荐学习节奏

| 周 | 内容 | 目标 |
|---|---|---|
| 第 1 周 | 第 1–3 步 | 每天 15 分钟 DevTools「点选元素、改属性、看变化」 |
| 第 2 周 | 第 4–6 步 | 能用自己的话讲清设置页的布局（卡片堆叠、网格、按钮） |
| 第 3 周 | 第 7–9 步 | 完成「自制 theme-sakura 主题」练习 |
| 第 4 周 | 第 10–11 步 | 给时钟页加一个自己设计的小动画 |

---

## 四、如何用 Figma 做 CSS 设计

Figma 和 CSS 的概念几乎**一一对应**，学会对应关系后，Figma 就是你的「可视化 CSS 编辑器」。

### 1. 核心对应关系

| Figma 概念 | 对应 CSS |
|---|---|
| Frame | `<div>` 容器 |
| Auto Layout（方向 / 间距 / 对齐） | `display: flex` + `flex-direction` + `gap` + `justify/align` |
| Padding（Auto Layout 内边距） | `padding` |
| 元素间距（Space between） | `margin` / `gap` |
| Fill / Stroke | `background` / `border` |
| Corner radius | `border-radius` |
| Effects → Drop shadow | `box-shadow` |
| Effects → Background blur | `backdrop-filter: blur()` |
| Color / Text Styles（样式库） | CSS 变量（`--primary` 等） |
| Constraints（约束） | 响应式行为（`%`、`minmax`） |
| Dev Mode 检查面板 | 直接生成可复制的 CSS 代码 |

### 2. 标准工作流：从 Figma 到代码

1. **画设计稿**：新建 Frame（选 Phone 尺寸，如 iPhone 390×844——本项目是移动端优先）。
2. **用 Auto Layout 代替手动拖动**：选中元素按 `Shift+A`。如果你在一层层手调 `x/y` 坐标，那就是该用 Auto Layout 的信号——它和 Flexbox 的思维完全一样。
3. **建立 Styles / Variables**：把主色、文字色、卡片色存成 Color Styles（或新版 Variables），字号存成 Text Styles。这一步就是在设计侧实现第 8 步的「设计令牌」。
4. **切到 Dev Mode**（按 `Shift+D`）：点击任何元素，右侧面板直接给出 CSS 代码，可一键复制，例如：
   ```css
   border-radius: 8px;
   background: linear-gradient(135deg, #75F0CF 0%, #B990FF 100%);
   box-shadow: 0 8px 24px rgba(117, 240, 207, 0.16);
   ```
5. **落地到项目**：**不要直接粘贴** Dev Mode 给的绝对定位代码（它默认输出 `position: absolute` + 写死宽高，那是给机器看的）。正确做法：只取颜色、字号、圆角、阴影这些**数值**；布局部分自己用 Flex / Grid 重写；颜色提炼成 `var(--xxx)` 变量。

### 3. 结合本项目的实战练习

最佳练习：在 Figma 里**临摹**本项目的设置页——

1. 建一个 390×844 的 Frame，背景填深色渐变（对应 `--bg-gradient`）。
2. 主题选择区建 8 格结构（对应 `.theme-grid` 的 Grid）。
3. 卡片用 Auto Layout 纵向排列，padding 设 18、间距 14（对应 `.card`）。
4. 按钮填渐变 + 阴影（对应 `.enter-btn`）。

临摹过程中你会被迫思考「这个效果在 Figma 里叫什么、在 CSS 里叫什么」，两遍下来两边的概念就都记住了。之后还可以反过来玩：先在 Figma 里设计一套新主题配色卡，再用第 8 步的方法实现成代码里的 `theme-xxx`。

---

## 附：速查表

| 想做的事 | 用什么 |
|---|---|
| 一行元素排列 / 居中 | Flexbox |
| 多行多列网格 | Grid |
| 钉在屏幕某处 | `position: fixed` |
| 元素内的小装饰 | `::before` / `::after` + `position: absolute` |
| 条纹 / 网格 / 波纹背景 | 重复渐变 + `background-size` |
| 换肤 / 主题 | CSS 变量 + 切换 class |
| 悬停反馈 | `:hover` + `transition` |
| 循环动效 | `@keyframes` + `animation` |
| 适配手机 | `@media` + `env(safe-area-inset-*)` |
