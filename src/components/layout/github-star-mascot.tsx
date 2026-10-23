"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import Image from "next/image";

/** Static pixel mascot: no frame switching, blending or interaction. */
export function GithubStarMascot() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={<span />} tabIndex={0} delay={200} className="mr-0.5 inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="球球给个star⭐吧">
      <Image
        src="/mascots/patrick-front-happy-static.png"
        alt=""
        width={144}
        height={176}
        unoptimized
        className="block h-11 w-9 object-contain"
      />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
            <Tooltip.Popup className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
              球球给个star⭐吧
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
