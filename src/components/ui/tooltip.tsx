"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

export const Tooltip = TooltipPrimitive.Root;
export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const createTooltipHandle = TooltipPrimitive.createHandle;

export function TooltipContent({ className, side = "top", sideOffset = 8, align = "center", anchor, children, ...props }: TooltipPrimitive.Popup.Props & Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "anchor">) {
  return <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} anchor={anchor} collisionPadding={10} className="z-[100]">
      <TooltipPrimitive.Popup role="tooltip" data-slot="tooltip-content" className={cn("w-max max-w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(24rem,calc(100dvh-2rem))] overflow-y-auto rounded-lg border border-border/80 bg-popover px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line break-words text-popover-foreground shadow-lg outline-none", className)} {...props}>
        {children}
      </TooltipPrimitive.Popup>
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>;
}
