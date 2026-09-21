import * as React from "react";

export interface PassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tier name, e.g. "3-DAY PASS". */
  name: string;
  /** Price string, e.g. "₩290,000". */
  price: string;
  /** Suffix beside the price, e.g. "/ 3일권". */
  cadence?: string;
  description?: string;
  /** Perk checklist lines. */
  perks?: string[];
  /** Cream + orange-border featured treatment. */
  featured?: boolean;
  /** Ribbon badge text, e.g. "BEST VALUE". */
  badge?: string;
  cta?: string;
  onSelect?: () => void;
}

/** Festival pass tier card with perks checklist and footer CTA. */
export function PassCard(props: PassCardProps): React.JSX.Element;
