import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared understated card navigation indicator; the card owns the link. */
export function CardCornerArrow({ className }: { className?: string }) {
  return <span aria-hidden className={cn("pointer-events-none inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-muted group-focus-within:bg-muted", className)}><ArrowUpRight className="size-3.5" /></span>;
}
