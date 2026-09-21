import * as React from "react";

export interface FooterColumn { heading: string; links: string[]; }

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  wordmark?: string;
  tagline?: string;
  columns?: FooterColumn[];
}

/** Cream multi-column footer preceded by the sunset stripe — closes every page. */
export function Footer(props: FooterProps): React.JSX.Element;
