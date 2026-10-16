export {
  clearEmailPlatformsSnapshotCache,
  loadEmailPlatformsSnapshot,
  resolveEmailPlatformsSnapshotPath,
} from "@/lib/email-platforms/snapshot";
export {
  emailDetailId,
  getEmailTypeCardById,
  getEmailTypeConfig,
  hasEmailPlatformData,
  isEmailDetailId,
  listEmailQuotesForType,
  listEmailTypeCards,
  parseEmailDetailId,
} from "@/lib/email-platforms/queries";
export type {
  EmailPlatformConfig,
  EmailPlatformQuote,
  EmailPlatformSnapshot,
  EmailQuoteStatus,
  EmailTypeCard,
  EmailTypeConfig,
} from "@/lib/email-platforms/types";
