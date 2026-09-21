import * as React from "react";

export interface SelectOption { value: string; label: string; }

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  options?: SelectOption[];
  wrapperStyle?: React.CSSProperties;
}

/** Native select styled to match Input. */
export function Select(props: SelectProps): React.JSX.Element;
