import * as React from "react";

export interface CtaBannerProps extends React.HTMLAttributes<HTMLElement> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Prepend the signature sunset stripe. */
  withStripe?: boolean;
}

/** Cream page-bottom CTA band with editorial headline. */
export function CtaBanner(props: CtaBannerProps): React.JSX.Element;
