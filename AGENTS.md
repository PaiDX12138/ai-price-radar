<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (AI Price Radar)

- UI: only shadcn (base-nova) + lucide + Tailwind — `.cursor/rules/ui-components.mdc`
- Collectors: evidence-based ShopApi / kami / dujiao — `.cursor/rules/card-shop-collectors.mdc`
- Phase 1 plan: `docs/phase1-liandong-shopapi.md`
- Collect schedule / worker: `docs/collect-schedule.md` (`pnpm start` + `pnpm worker`)
- Official regional prices (ChatGPT + Claude + Cursor + Grok/X + Kiro + Gemini SQLite): `docs/official-prices.md` (`pnpm official:migrate` + `pnpm collect:official`)
- Email / SMS OTP platform prices: `config/email-platforms/` + `config/sms-platforms/`（`pnpm collect:otp` 自动更新；见 `docs/official-prices.md`）
- Scaffold & one-click setup: `docs/scaffold.md`
- Collect worker (separate process): `pnpm worker` — `docs/collect-schedule.md`
- Never commit real shop tokens or `.env.local`
