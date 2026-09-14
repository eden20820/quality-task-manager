"use client";

import Link, { type LinkProps } from "next/link";
import { useState, type AnchorHTMLAttributes } from "react";

type PrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

/** Upgrade Next.js' normal prefetch to a full prefetch once navigation intent is clear. */
export function PrefetchLink({ onMouseEnter, onFocus, onTouchStart, ...props }: PrefetchLinkProps) {
  const [hasIntent, setHasIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={hasIntent ? true : props.prefetch}
      onMouseEnter={(event) => { setHasIntent(true); onMouseEnter?.(event); }}
      onFocus={(event) => { setHasIntent(true); onFocus?.(event); }}
      onTouchStart={(event) => { setHasIntent(true); onTouchStart?.(event); }}
    />
  );
}
