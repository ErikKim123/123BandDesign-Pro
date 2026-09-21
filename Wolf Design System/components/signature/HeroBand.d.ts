import * as React from "react";

export interface HeroBandProps extends React.HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Button row (pass <Button> nodes). */
  actions?: React.ReactNode;
  /** Right-panel media — an <img>, <image-slot>, or video. Omit for full-width text hero. */
  media?: React.ReactNode;
}

/** Atmospheric sunset hero band — editorial display headline over a sunset sky. */
export function HeroBand(props: HeroBandProps): React.JSX.Element;
