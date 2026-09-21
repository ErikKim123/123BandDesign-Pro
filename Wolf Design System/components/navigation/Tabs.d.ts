import * as React from "react";

export interface TabItem { value: string; label: React.ReactNode; }

/**
 * Props for Wolf tab navigation.
 * @startingPoint section="Navigation" subtitle="Tabs & promo banner" viewport="700x300"
 */
export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** @default "segmented" */
  variant?: "segmented" | "pill";
  style?: React.CSSProperties;
}

/**
 * Tab navigation — underline (segmented) or pill style.
 */
export function Tabs(props: TabsProps): React.JSX.Element;
