import * as React from "react";

/**
 * Props for the Wolf content card.
 * @startingPoint section="Data" subtitle="Cards, pass tiers & stat callouts" viewport="760x440"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "base" */
  variant?: "base" | "feature" | "cream" | "cream-soft" | "product" | "photographic";
  children?: React.ReactNode;
}

/**
 * Flat content card — 12px radius, hairline border by default.
 */
export function Card(props: CardProps): React.JSX.Element;
