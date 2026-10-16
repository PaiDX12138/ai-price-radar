import { OfficialOtpTypeCard } from "@/components/otp/official-otp-type-card";
import type { EmailTypeCard } from "@/lib/email-platforms/types";

export function OfficialEmailCard({ product }: { product: EmailTypeCard }) {
  return (
    <OfficialOtpTypeCard
      product={product}
      tab="email"
      badge="接码按次"
      tabLabel="邮箱"
    />
  );
}
