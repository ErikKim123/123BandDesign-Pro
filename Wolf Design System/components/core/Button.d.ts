import * as React from "react";

/**
 * Props for the Wolf action button.
 * @startingPoint section="Core" subtitle="Buttons in every variant & size" viewport="700x360"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. `primary` = Wolf orange CTA (default). */
  variant?: "primary" | "cream" | "dark" | "secondary" | "on-cream" | "link";
  /** Height/padding scale. @default "md" */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Stretch to fill the container width. */
  fullWidth?: boolean;
  /** Icon node rendered before the label. */
  leftIcon?: React.ReactNode;
  /** Icon node rendered after the label. */
  rightIcon?: React.ReactNode;
  /** Render as an anchor when provided. */
  href?: string;
  children?: React.ReactNode;
}

/**
 * The Wolf action button — saturated-orange primary CTA plus cream, dark,
 * secondary, on-cream and inline-link variants. 8px radius, never a pill.
 */
export function Button(props: ButtonProps): React.JSX.Element;
