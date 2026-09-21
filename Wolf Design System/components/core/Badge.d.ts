import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "orange" */
  variant?: "orange" | "cream" | "dark" | "outline";
  children?: React.ReactNode;
}

/** Small pill status / category badge. Pills are reserved for badges in Wolf. */
export function Badge(props: BadgeProps): React.JSX.Element;
