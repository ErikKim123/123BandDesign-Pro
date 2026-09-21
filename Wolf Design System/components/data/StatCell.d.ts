import * as React from "react";

export interface StatCellProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  label?: string;
  align?: "left" | "center";
}

/** Editorial stat callout — display-face number over a caption. */
export function StatCell(props: StatCellProps): React.JSX.Element;
