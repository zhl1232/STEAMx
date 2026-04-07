import * as React from "react";

import { cn } from "@/lib/utils";

type CoinIconProps = React.ComponentPropsWithoutRef<"svg"> & {
  title?: string;
};

export function CoinIcon({ className, title, ...props }: CoinIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}

      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="2.2" />
      <rect
        x="9.1"
        y="9.1"
        width="5.8"
        height="5.8"
        rx="0.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      />
    </svg>
  );
}
