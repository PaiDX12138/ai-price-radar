import { OfficialOtpTypeCard } from "@/components/otp/official-otp-type-card";
import type { SmsTypeCard } from "@/lib/sms-platforms/types";

export function OfficialSmsCard({ product }: { product: SmsTypeCard }) {
  return (
    <OfficialOtpTypeCard
      product={product}
      tab="sms"
      badge="短信按次"
      tabLabel="接码"
    />
  );
}
