# 全站统一悬浮提示

## 使用

普通文字直接附在原有 DOM 元素，不改变布局，也不需要把服务端组件改为客户端组件：

```tsx
<span data-tooltip="近15日平均响应耗时">15日均</span>
<a href={url} aria-label="打开站点首页" data-tooltip="新标签页打开官网">官网</a>
<ToneChip tooltip="官网公布的基础充值比例">倍率 ¥1 = $1</ToneChip>
<TextBand tooltip="已核实的更新时间">2026/10/28 14:22</TextBand>
<AutoFitPrice text="$12.50" tooltip="站点公布的价格" />
```

复杂图表、分组、价格详情继续使用统一组件。`TooltipTrigger` 的 `render` 可以保留原标签；不要嵌套按钮或链接。

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

<Tooltip>
  <TooltipTrigger render={<span />} tabIndex={0} aria-label="价格说明">价格说明</TooltipTrigger>
  <TooltipContent><dl>{/* 简洁的结构化信息 */}</dl></TooltipContent>
</Tooltip>
```

使用 Provider 时沿用 `delay={120}`；无需单独复制浮层样式。

## 机制与边界

- `RootLayout` 只挂一个 `SiteTooltips`，委托处理普通提示。动态筛选、翻页、服务端表格无需重新绑定或逐个创建 React tooltip。
- `TooltipContent` 统一圆角、边框、主题色、阴影、最大宽高、长文换行、视口碰撞避让，Portal 不受卡片 `overflow-hidden` 裁剪。
- 鼠标停留 120ms 显示，离开稍延迟关闭，可进入浮层阅读；键盘焦点即时显示，Escape / 点击 / 输入 / 滚动 / 页面失焦时收起。触摸不制造悬停提示。
- 不改变按钮与外链默认行为。打开时追加 `aria-describedby`，关闭时只移除自身关联，保留原有无障碍描述。
- 富内容触发器优先，不叠加父级普通说明。内容以 React 文本渲染，不解析 HTML。
- 短标签以实际元素定位；超过 160px 宽或 48px 高的普通说明容器，鼠标悬停时使用靠近指针的局部锚点，不按整行中心定位。打开后锚点保持稳定，不追逐鼠标；键盘操作仍以焦点元素定位。模型标题的说明挂在文字本身，而不是撑满剩余宽度的 flex 容器。
- 中转列表、卡网渠道卡透明跳转遮罩标记 `data-tooltip-surface`；仅在该遮罩内读取绘制层级，按动画帧合并鼠标移动，其他元素直接查找最近说明。没有为提示修改整卡点击范围或堆叠层级。
- 不扫描全站 DOM，不做文档级 MutationObserver；只在提示打开时观察当前元素的说明属性变化。

## 后续约束

ESLint 的 `radar-ui/no-native-tooltip` 阻止原生提示属性及常见动态写法，`radar-ui/shared-tooltip-only` 阻止业务组件直接导入原始 Tooltip 或自行声明 `role="tooltip"` 浮层。

不要把 Next Metadata、API 返回值的 `title`、章节标题等业务字段当成提示改名；`iframe` 的无障碍标题保留。`title=""` 仅可用于显式压制继承的原生提示，不放说明文字。

已有卡网、官网地区价、接码平台、中转站点、导航等原生提示已迁移；导航吉祥物也改用同一个 `TooltipContent`。没有更改卡片尺寸、业务数据、采集或排序。

本次按用户要求仅修改代码和规范，未运行 lint、类型检查、测试、构建或浏览器检查。
