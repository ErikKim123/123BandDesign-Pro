import * as React from "react";

/**
 * Props for the Wolf text field.
 * @startingPoint section="Forms" subtitle="Input, Textarea & Select fields" viewport="700x340"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperStyle?: React.CSSProperties;
}

/**
 * Single-line text field — 44px tall, hairline-strong border, orange focus.
 */
export function Input(props: InputProps): React.JSX.Element;
