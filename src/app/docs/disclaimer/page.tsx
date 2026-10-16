import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TextBand, type TextBandTone } from "@/components/catalog/text-band";
import { HistoryBackLink } from "@/components/layout/history-back-link";
import { BRAND_NAME_EN, BRAND_NAME_ZH } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "免责声明",
  description: `${BRAND_NAME_ZH} 信息聚合边界、购买风险与使用限制。`,
};

/**
 * 免责声明：正式文书版式（双线框 + 疏朗排版 + 半高色带重点）。
 * 不做拟物轴杆 / 圆纽。
 */
export default function DisclaimerPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="mb-5 text-xs text-muted-foreground">
        <HistoryBackLink
          fallbackHref="/"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          ← 返回
        </HistoryBackLink>
      </p>

      <article
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-card",
          "px-5 py-8 sm:px-10 sm:py-11",
          "shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_4%,transparent)]",
        )}
      >
        {/* 双线内框：文书感 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2.5 rounded-[calc(var(--radius)+2px)] border border-border/60 sm:inset-3.5"
        />

        <div className="relative">
          <header className="mb-9 space-y-3 border-b border-border/70 pb-7 text-center">
            <p className="text-[10px] font-medium tracking-[0.28em] text-muted-foreground">
              DISCLAIMER
            </p>
            <h1 className="text-[1.4rem] font-semibold tracking-tight sm:text-[1.65rem]">
              <TextBand tone="ink" className="font-semibold">
                免责声明
              </TextBand>
            </h1>
            <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">
              {BRAND_NAME_ZH}（{BRAND_NAME_EN}）是开源的公开信息聚合与比价工具。
              使用本站即表示你已阅读并接受下列条款。
            </p>
          </header>

          <div className="space-y-8 text-[13.5px] leading-relaxed sm:text-sm">
            <Section n="01" title="服务性质">
              <p>
                本项目只做
                <Mark tone="ink">购买前的价格与库存信息整理</Mark>
                ，不销售账号、卡密、订阅或任何数字商品，不参与撮合、收款、发货或售后。
              </p>
              <p>
                「最低价」「有货」「质保价」「官网正价」等展示，
                <Mark tone="amber">不构成推荐、背书或成交承诺</Mark>
                。
              </p>
            </Section>

            <Section n="02" title="比价与购买">
              <p>
                报价来自公开渠道或你自行配置的数据源，可能延迟、缺失或与原站不一致。
                <Mark tone="rose">本站不保证你能按展示价格成功购买</Mark>
                ，也不保证货源真实、可交付或可售后。
              </p>
              <p>
                下单前请自行打开原站链接核验价格、库存、规则与卖家资质。
                与第三方的一切交易，由你与对方自行约定并承担风险。
              </p>
            </Section>

            <Section n="03" title="数据说明">
              <p>
                第三方站点可能随时改价、下架或风控。
                <Mark tone="amber">采集失败不等于缺货</Mark>
                ；过期报价不得视为可成交价。
              </p>
              <p>最终价格、库存、交付与售后，一律以原站展示及卖家约定为准。</p>
            </Section>

            <Section n="04" title="风险与责任">
              <p>
                卡网与货源站存在欺诈、货不对板、封号、共享账号、售后缺失等风险。
                请自行判断并谨慎交易；大额请先小额验证。
              </p>
              <p>
                在法律允许的范围内，维护者与贡献者不对因使用本工具、依赖其信息或与第三方交易所致损失承担责任。
              </p>
            </Section>

            <Section n="05" title="采集与合规">
              <p>
                默认只访问公开或你授权配置的接口与页面，
                <Mark tone="ink">不绕过验证码、登录墙或 WAF</Mark>
                。
              </p>
              <p>
                自托管部署须遵守目标站条款与当地法律；滥用采集或违法使用的后果由部署者自行承担。
              </p>
            </Section>

            <Section n="06" title="许可">
              <p>
                源代码按仓库{" "}
                <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                  LICENSE
                </code>{" "}
                （PolyForm Noncommercial）发布：允许非商业自用与学习，
                <Mark tone="amber">禁止商用</Mark>
                。商业授权请联系维护者。
              </p>
            </Section>

            <Section n="07" title="反馈">
              <p>
                问题与数据更正请通过 GitHub Issues 提交。欺诈等事项请同时向原平台举报；本项目无法代为追偿或担保。
              </p>
            </Section>
          </div>

          <footer className="mt-10 border-t border-border/70 pt-4 text-center text-[11px] tabular-nums text-muted-foreground">
            最近修订 · 2026-10-16
          </footer>
        </div>
      </article>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-baseline gap-2.5 text-[15px] font-semibold tracking-tight text-foreground">
        <span className="font-mono text-[11px] font-medium tabular-nums tracking-wide text-muted-foreground">
          {n}
        </span>
        <TextBand tone="violet" className="font-semibold">
          {title}
        </TextBand>
      </h2>
      <div className="space-y-2 pl-8 text-muted-foreground [&_p]:text-[13.5px] sm:[&_p]:text-sm">
        {children}
      </div>
    </section>
  );
}

function Mark({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: TextBandTone;
}) {
  return (
    <TextBand tone={tone} className="mx-0.5 font-medium text-foreground">
      {children}
    </TextBand>
  );
}
