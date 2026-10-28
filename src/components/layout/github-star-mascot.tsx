"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Image from "next/image";

/** Static pixel mascot: no frame switching, blending or interaction. */
export function GithubStarMascot() {
  return (
    <TooltipProvider delay={120} closeDelay={80}>
      <Tooltip>
        <TooltipTrigger render={<span />} tabIndex={0} className="mr-0.5 inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="球球给个star⭐吧">
      <Image
        src="/mascots/patrick-front-happy-static.png"
        alt=""
        width={144}
        height={176}
        unoptimized
        className="block h-11 w-9 object-contain"
      />
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" sideOffset={6}>球球给个star⭐吧</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
