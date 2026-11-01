/** Display order belongs to this sponsor strip, never to the station ranking. */
export const TRANSIT_SPONSORS = [
  {
    id: "rightcode",
    name: "RightCode",
    image: "/brand/sponsors/rightcode.jpg",
    href: "https://rightapi.io/register?aff=434bbb9b",
    description: "RightCode · 提供多模型 AI API 接入服务。",
    sponsored: true,
  },
  {
    id: "patrick-star-toll",
    name: "Patrick Star Toll",
    image: "/brand/sponsors/patrick-star-toll.png",
    href: "https://github.com/PaiDX12138/pdx-toll-releases",
    description: "Patrick Star Toll · AI 开发工具桌面工作台，集中管理账号、额度、服务商配置与 SSH。",
    sponsored: false,
  },
  {
    id: "aliyun",
    name: "阿里云 Alibaba Cloud",
    image: "/brand/sponsors/aliyun-cloud.png",
    href: "https://www.aliyun.com/",
    description: "阿里云 · 提供云服务器等云计算服务。",
    sponsored: true,
  },
] as const;
