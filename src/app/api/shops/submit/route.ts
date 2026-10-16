import { NextResponse } from "next/server";
import { kickImmediateShopCollect } from "../../../../../collectors/kick-collect.mjs";
import {
  fetchDetailPageTitle,
  friendlyHomepageFailure,
  normalizeShopUrl,
  probeShopUrl,
  upsertShopFromProbe,
  verifyDetailOfferAgainstType,
} from "../../../../../collectors/probe-shop-url.mjs";
import {
  appendShopProbeRun,
  findSuccessfulProbeByInputUrl,
  openShopsDb,
} from "../../../../../collectors/shops-db.mjs";

const DETAIL_VERIFY_KIND = "detail_verify";

type SubmitBody = {
  mode?: string;
  url?: string;
  productLine?: string;
  deliveryType?: string;
};

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return json(
      {
        ok: false,
        code: "bad_request",
        title: "请求无效",
        detail: "请刷新页面后重试",
        fieldHint: "提交失败",
      },
      400,
    );
  }

  const mode = String(body.mode || "homepage");
  const url = String(body.url || "").trim();
  const productLine = String(body.productLine || "").trim();
  const deliveryType = String(body.deliveryType || "").trim();
  const normalizedUrl = normalizeShopUrl(url) || url;

  if (!url) {
    return json(
      {
        ok: false,
        code: "empty_url",
        title: "还差一步",
        detail: "请先粘贴链接",
        fieldHint: "请填写链接",
      },
      400,
    );
  }

  if (mode === "other") {
    if (!productLine || !deliveryType) {
      return json(
        {
          ok: false,
          code: "need_selection",
          title: "请选完整",
          detail: "商品线和类型都要选好",
          fieldHint: "请选择商品线与类型",
        },
        400,
      );
    }

    try {
      const db = openShopsDb();
      const prior = findSuccessfulProbeByInputUrl(db, normalizedUrl, {
        detectedKind: DETAIL_VERIFY_KIND,
      });
      if (prior) {
        return json({
          ok: true,
          code: "detail_duplicate",
          duplicate: true,
          title: "已经核对过",
          detail: "这条商品链接之前已经通过核对，无需重复提交",
          fieldHint: "链接已提交过",
        });
      }
    } catch {
      // DB 不可用时仍允许继续核对，不挡主流程
    }

    const fetched = await fetchDetailPageTitle(url);
    if (!fetched.ok) {
      return json(
        {
          ok: false,
          code: fetched.code || "page_unreachable",
          title: "打不开商品页",
          detail: fetched.error || "请换一条可公开访问的详情链接",
          fieldHint: fetched.error || "链接或页面有问题",
        },
        422,
      );
    }

    const verified = verifyDetailOfferAgainstType({
      title: fetched.title!,
      platform: productLine,
      deliveryType,
    });

    if (!verified.ok) {
      return json(
        {
          ok: false,
          code: verified.code || "classify_mismatch",
          title: "和所选类型对不上",
          detail: verified.detail || "请调整选择或换链接",
          fieldHint: verified.fieldHint || "不符合当前归类",
          titleText: verified.title,
          productSlug: verified.productSlug,
          productName: verified.productName,
        },
        422,
      );
    }

    try {
      const db = openShopsDb();
      appendShopProbeRun(db, {
        shopId: null,
        inputUrl: normalizedUrl,
        ok: true,
        detectedKind: DETAIL_VERIFY_KIND,
        error: null,
      });
    } catch {
      // 记不住也不影响本次核对结果
    }

    return json({
      ok: true,
      code: "detail_matched",
      title: "核对通过",
      detail: `已识别为「${verified.productName}」`,
      productSlug: verified.productSlug,
      productName: verified.productName,
      titleText: verified.title,
    });
  }

  // homepage
  const probed = await probeShopUrl(url);
  if (!probed?.ok) {
    const friendly = friendlyHomepageFailure(probed || {});
    return json(
      {
        ok: false,
        ...friendly,
      },
      422,
    );
  }

  try {
    const db = openShopsDb();
    const upsert = upsertShopFromProbe(probed, {
      db,
      submittedBy: "user",
      inputUrl: normalizedUrl,
    });
    if (upsert.action === "rejected") {
      return json(
        {
          ok: false,
          code: "upsert_rejected",
          title: "未能写入",
          detail: "店铺检查未通过，请换一条首页链接",
          fieldHint: "未通过检查",
        },
        422,
      );
    }

    const shopName = probed.name || upsert.id;
    if (upsert.action === "skipped") {
      return json({
        ok: true,
        code: "shop_duplicate",
        duplicate: true,
        title: "已经收录过",
        detail: `「${shopName}」已在采集列表里，无需重复提交`,
        fieldHint: "店铺已存在",
        shopId: upsert.id,
        shopName,
      });
    }

    let collectKicked = false;
    if (upsert.action === "inserted") {
      collectKicked = kickImmediateShopCollect(upsert.id).kicked;
    }

    return json({
      ok: true,
      code: upsert.action === "inserted" ? "shop_inserted" : "shop_updated",
      title: upsert.action === "inserted" ? "已收录" : "已更新",
      detail:
        upsert.action === "inserted"
          ? collectKicked
            ? `「${shopName}」已加入，正在同步商品`
            : `「${shopName}」已加入采集队列`
          : `「${shopName}」信息已刷新`,
      shopId: upsert.id,
      shopName,
      collectKicked,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(
      {
        ok: false,
        code: "server_error",
        title: "服务暂时不可用",
        detail: /no such file|ENOENT|shops\.sqlite/i.test(msg)
          ? "店铺档案未就绪，请稍后再试"
          : "请稍后重试",
        fieldHint: "暂时无法提交",
      },
      500,
    );
  }
}
