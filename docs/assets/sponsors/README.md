# 赞助品牌资源

主仓库 README 的赞助区使用本地资源，不依赖外链图片服务；GitHub 表格左列为矩形品牌图，右列为简介，Logo 保留在品牌图左侧，不展示福利文案或推广码。

- `rightcode.jpg`：RightCode 已公开用于赞助展示的品牌横图，来源为 [CC Switch 赞助资源](https://github.com/farion1231/cc-switch/blob/main/assets/partners/logos/rightcode.jpg)，保留原图。版式参考其 [README](https://github.com/farion1231/cc-switch/blob/main/README.md) 的品牌图与说明双列结构，未复制其推广文案或推广码。
- `public/brand/sponsors/aliyun-cloud.png`：通过内置 image_gen 生成的阿里云科技感横图，README 与站内共享同一资源，旧浅色SVG及其副本已删除。保留品牌名称与橙色标识，增加云基础设施主题；不编造优惠、认证或合作等级。

RightCode 的图片和品牌名均指向维护者提供的推广链接 `https://rightapi.io/register?aff=434bbb9b`，链接中的推广参数保留，不展示首充返利等福利文案。阿里云暂使用官网首页，不编造优惠。

PackyAPI 的图片和品牌名均使用维护者提供的推广链接 `https://www.packyapi.ai/register?aff=irEX`，中转列表名称和详情官网入口通过现有 `sponsorship.affiliateUrl` 同样使用该链接；原始站点地址和采集接口不变。`packyapi-official.svg` 原样保存自[官网完整 Logo](https://www.packyapi.ai/logo-full.svg)，已核实为官网桌面导航使用的资源；替换此前自行拼制的横图，不重新绘制或改写品牌字样。README与站内共用，站内用白底及水平留白完整展示黑色官方 Logo，不添加福利文案。

本文记录品牌资源与展示文案；隐藏推广码不改变推广链接、采集地址、报价或模型排序。

## 各板块首页公共赞助区

公共组件为 `src/components/layout/site-sponsors.tsx`，赞助列表统一维护在 `src/data/sponsors.ts`，联系弹窗为 `src/components/layout/sponsor-contact.tsx`。卡网行情（含 `/channels` 列表入口）、官网定价、中转站点的首页在列表/分页之后各显示一次；筛选无结果时仍显示，不挂到全站根布局，详情页、提交页及文档页不额外展示。新增板块首页直接复用 `SiteSponsors`，不复制图片、描述或联系逻辑。

底部横图的悬浮文案仅介绍对应平台或项目功能，不显示返利、首充、福利或推广码。RightCode为多模型AI API接入服务，Patrick Star Toll为AI开发工具桌面工作台，阿里云为云服务器等云计算服务；中转列表礼物图标提示与详情合作卡同样只保留合作说明，不展示已配置的福利文案。

“赞助商”标题使用16px（sm以上17px），右侧紧邻的“成为赞助商”复用现有小型无边框按钮。点击通过共享Dialog展示合作说明与作者QQ `3632164290`，号码可选中，右侧图标支持复制及成功反馈；沿用默认遮罩、关闭按钮、Escape/点击外部关闭和焦点返回，不额外创建弹窗样式或引入新组件库。

公开图片保存于 `public/brand/sponsors/`，固定顺序为 RightCode、PackyAPI、Patrick Star Toll、阿里云。README同样展示这四个伙伴，Patrick Star Toll直接复用站内图片及仓库链接。显示“赞助商”标题，图片下不展示额外名称、描述或推广码。介绍使用全站统一自定义悬浮窗，固定锚定对应卡片，优先上方居中并自动避让，不跟随鼠标位置漂移。统一40:17图片框，完整等比显示，不裁掉Logo或文字。赞助区使用父容器全宽，1024px及以上四列、640px及以上两列、更窄时单列，各卡等宽填满整行；不再使用区域最大宽度或单卡320px上限。

- `rightcode.jpg`：复用上述已有品牌横图，不改变README原图。
- `aliyun-cloud.png`：README与站内使用同一张新横图，跳转地址不变。生成提示词规格：40:17横幅，深石墨蓝底、阿里云橙色Logo与准确英文名“Alibaba Cloud”，右侧为精致云端服务器及细网络光路；缩略图可辨识，无额外标语、网址、按钮、优惠或认证标签。替换资源不改变卡片尺寸、靠左排版或固定锚点提示。
- `patrick-star-toll.png`：通过内置 image_gen 生成。正式英文名与Logo核对自[公开版本仓库](https://github.com/PaiDX12138/pdx-toll-releases)，链接指向仓库首页，不是私有源码仓库、下载附件或发布页。生成时参考该仓库的 `assets/logo.png`，保留派大星动漫形象、电脑与咖啡；错误的Workbench草稿已删除，未进入项目。

生成提示词规格：40:17横幅，左侧使用参考图的派大星动漫Logo；右侧仅显示准确英文名“Patrick Star Toll”，可分为“Patrick Star”和“Toll”两行；米白底、墨绿色字、浅薄荷绿点缀，简洁留白，无中文、标语、网址、按钮或外部圆角框。完整等比显示，适合约280×119px的小尺寸赞助卡。
