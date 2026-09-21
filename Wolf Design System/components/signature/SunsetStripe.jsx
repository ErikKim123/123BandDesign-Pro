import React from "react";

/**
 * The Wolf sunset stripe — a full-width horizontal gradient band
 * (orange → sunshine → yellow → cream) that closes every page above the footer.
 * THE brand's most recognizable signature element. Never drop it.
 */
export function SunsetStripe({ height = 14, style, ...rest }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        height: typeof height === "number" ? height + "px" : height,
        background: "var(--sunset-stripe)",
        ...style,
      }}
      {...rest}
    />
  );
}
