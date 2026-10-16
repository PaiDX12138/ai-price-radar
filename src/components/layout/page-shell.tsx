import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  narrow?: boolean;
};

export function PageShell({ children, narrow = false }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 lg:px-6",
        narrow ? "max-w-3xl" : "max-w-[var(--apr-content-max)]"
      )}
    >
      {children}
    </div>
  );
}
