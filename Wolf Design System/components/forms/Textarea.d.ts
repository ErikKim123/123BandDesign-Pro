import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  wrapperStyle?: React.CSSProperties;
}

/** Multi-line text area matching Input styling. */
export function Textarea(props: TextareaProps): React.JSX.Element;
