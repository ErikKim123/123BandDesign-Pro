import * as React from "react";

export interface PromoBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
  dismissible?: boolean;
}

/** Sticky black promo strip above the top nav. */
export function PromoBanner(props: PromoBannerProps): React.JSX.Element;
