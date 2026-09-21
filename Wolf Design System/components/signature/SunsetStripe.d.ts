import * as React from "react";

/**
 * Props for the signature sunset stripe.
 * @startingPoint section="Signature" subtitle="Hero band, sunset stripe, CTA & footer" viewport="900x560"
 */
export interface SunsetStripeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Band height in px (or any CSS length). @default 14 */
  height?: number | string;
}

/**
 * The signature Wolf sunset stripe — full-width gradient band closing every page.
 */
export function SunsetStripe(props: SunsetStripeProps): React.JSX.Element;
