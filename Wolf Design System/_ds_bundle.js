/* @ds-bundle: {"format":3,"namespace":"WolfDesignSystem_4d4911","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"PassCard","sourcePath":"components/data/PassCard.jsx"},{"name":"StatCell","sourcePath":"components/data/StatCell.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"PromoBanner","sourcePath":"components/navigation/PromoBanner.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"CtaBanner","sourcePath":"components/signature/CtaBanner.jsx"},{"name":"Footer","sourcePath":"components/signature/Footer.jsx"},{"name":"HeroBand","sourcePath":"components/signature/HeroBand.jsx"},{"name":"SunsetStripe","sourcePath":"components/signature/SunsetStripe.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"e0ccf8e536e0","components/core/Button.jsx":"024b7c6231b5","components/data/Card.jsx":"523062d60be1","components/data/PassCard.jsx":"a345f7c26fd6","components/data/StatCell.jsx":"7b3c6b757e0b","components/forms/Input.jsx":"545c6baa02b0","components/forms/Select.jsx":"6d14e6d030ec","components/forms/Textarea.jsx":"a0ba48b59177","components/navigation/PromoBanner.jsx":"508827fc643b","components/navigation/Tabs.jsx":"acd62977781c","components/signature/CtaBanner.jsx":"01e10af58d53","components/signature/Footer.jsx":"6fbd0ef07da4","components/signature/HeroBand.jsx":"225c7e65be5a","components/signature/SunsetStripe.jsx":"667db76063fc","ui_kits/website/App.jsx":"53ef3235a1b2","ui_kits/website/BrowseScreen.jsx":"cb9a9231bd7d","ui_kits/website/CheckoutScreen.jsx":"08b71f153b29","ui_kits/website/DetailScreen.jsx":"f37f57e5fc7c","ui_kits/website/FestivalCard.jsx":"369e1ef8e446","ui_kits/website/HomeScreen.jsx":"2baef6b91401","ui_kits/website/Nav.jsx":"e902a9441290","ui_kits/website/WalletScreen.jsx":"0e2ffb64f940","ui_kits/website/data.js":"a259383f55af"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.WolfDesignSystem_4d4911 = window.WolfDesignSystem_4d4911 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  orange: {
    background: "var(--color-primary)",
    color: "var(--color-on-primary)",
    border: "1px solid transparent"
  },
  cream: {
    background: "var(--color-cream-deeper)",
    color: "var(--color-ink)",
    border: "1px solid transparent"
  },
  dark: {
    background: "var(--color-ink)",
    color: "var(--color-on-dark)",
    border: "1px solid transparent"
  },
  outline: {
    background: "transparent",
    color: "var(--color-steel)",
    border: "1px solid var(--color-hairline-strong)"
  }
};

/**
 * Small pill status / category badge. Pills (--radius-full) are reserved
 * for badges in Wolf — buttons never use them.
 */
function Badge({
  variant = "orange",
  children,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.orange;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
      fontWeight: 600,
      lineHeight: 1.4,
      padding: "4px 10px",
      borderRadius: "var(--radius-full)",
      ...v,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const PADDING = {
  sm: "7px 14px",
  md: "10px 20px",
  lg: "13px 26px"
};
const FONT_SIZE = {
  sm: "13px",
  md: "14px",
  lg: "15px"
};
const VARIANTS = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-on-primary)",
    border: "1px solid transparent"
  },
  cream: {
    background: "var(--color-cream)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-beige-deep)"
  },
  dark: {
    background: "var(--color-ink)",
    color: "var(--color-on-dark)",
    border: "1px solid transparent"
  },
  secondary: {
    background: "transparent",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-strong)"
  },
  "on-cream": {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-beige-deep)"
  },
  link: {
    background: "transparent",
    color: "var(--color-primary)",
    border: "1px solid transparent",
    padding: "0",
    textDecoration: "underline",
    textUnderlineOffset: "3px"
  }
};

/**
 * Wolf primary action button. Sober editorial geometry — 8px radius, never a pill.
 */
function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  href,
  onClick,
  children,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isLink = variant === "link";
  const baseStyle = {
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontFamily: "var(--font-ui)",
    fontSize: FONT_SIZE[size],
    fontWeight: 500,
    lineHeight: 1.3,
    padding: isLink ? "0" : PADDING[size],
    borderRadius: isLink ? "0" : "var(--radius-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard)",
    whiteSpace: "nowrap",
    textDecoration: v.textDecoration,
    textUnderlineOffset: v.textUnderlineOffset,
    ...v,
    ...(disabled ? {
      background: isLink ? "transparent" : "var(--color-hairline)",
      color: "var(--color-muted)",
      borderColor: "transparent",
      opacity: isLink ? 0.5 : 1
    } : {}),
    ...style
  };
  const content = /*#__PURE__*/React.createElement(React.Fragment, null, leftIcon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex"
    }
  }, leftIcon) : null, children, rightIcon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex"
    }
  }, rightIcon) : null);
  if (href && !disabled) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      style: baseStyle,
      onClick: onClick
    }, rest), content);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    style: baseStyle
  }, rest), content);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  base: {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-soft)",
    padding: "var(--space-xl)",
    boxShadow: "none"
  },
  feature: {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-soft)",
    padding: "var(--space-xxl)",
    boxShadow: "none"
  },
  cream: {
    background: "var(--color-cream)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-beige-deep)",
    padding: "var(--space-xxl)",
    boxShadow: "none"
  },
  "cream-soft": {
    background: "var(--color-surface-cream-soft)",
    color: "var(--color-ink)",
    border: "1px solid transparent",
    padding: "var(--space-xxl)",
    boxShadow: "none"
  },
  product: {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-soft)",
    padding: "var(--space-xxl)",
    boxShadow: "var(--shadow-2)"
  },
  photographic: {
    background: "var(--color-surface-code)",
    color: "var(--color-on-dark)",
    border: "1px solid transparent",
    padding: "0",
    boxShadow: "var(--shadow-3)",
    overflow: "hidden"
  }
};

/**
 * Flat content card. 12px radius (the dominant Wolf card radius). Default leans
 * on a hairline border, not shadow — reserve elevation for `product`/`photographic`.
 */
function Card({
  variant = "base",
  children,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.base;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: "var(--radius-lg)",
      ...v,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/PassCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Festival pass tier card. `featured` swaps to cream + orange border.
 * Perks render as a checklist; CTA spans the footer.
 */
function PassCard({
  name,
  price,
  cadence = "",
  description,
  perks = [],
  featured = false,
  badge,
  cta = "패스 구매",
  onSelect,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-lg)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-xxl)",
      background: featured ? "var(--color-cream)" : "var(--color-canvas)",
      border: featured ? "2px solid var(--color-primary)" : "1px solid var(--color-hairline-soft)",
      position: "relative",
      ...style
    }
  }, rest), badge ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "-12px",
      left: "var(--space-xxl)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: featured ? "orange" : "dark"
  }, badge)) : null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "18px",
      fontWeight: 600,
      color: "var(--color-ink)"
    }
  }, name), description ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: "var(--color-steel)",
      marginTop: "4px"
    }
  }, description) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "6px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "56px",
      lineHeight: 1,
      letterSpacing: "-1px",
      color: "var(--color-ink)"
    }
  }, price), cadence ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: "var(--color-steel)"
    }
  }, cadence) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      flex: 1
    }
  }, perks.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: "10px",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--color-primary)",
      fontWeight: 700,
      lineHeight: "1.55",
      flexShrink: 0
    }
  }, "\u2713"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      lineHeight: 1.55,
      color: "var(--color-slate)"
    }
  }, p)))), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: featured ? "primary" : "dark",
    fullWidth: true,
    onClick: onSelect
  }, cta));
}
Object.assign(__ds_scope, { PassCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/PassCard.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCell.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Editorial stat callout. Big number in PP-Editorial-substitute display face.
 */
function StatCell({
  value,
  label,
  align = "left",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      padding: "var(--space-lg)",
      textAlign: align,
      alignItems: align === "center" ? "center" : "flex-start",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "56px",
      lineHeight: 1.1,
      letterSpacing: "-1px",
      color: "var(--color-ink)"
    }
  }, value), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: "var(--color-steel)",
      maxWidth: "22ch"
    }
  }, label) : null);
}
Object.assign(__ds_scope, { StatCell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCell.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Single-line text field. 44px height, hairline-strong border, orange focus ring.
 */
function Input({
  label,
  hint,
  error,
  id,
  style,
  wrapperStyle,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || (label ? "in-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      ...wrapperStyle
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      fontWeight: 500,
      color: "var(--color-ink)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    onFocus: e => {
      setFocused(true);
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      setFocused(false);
      rest.onBlur && rest.onBlur(e);
    },
    style: {
      height: "44px",
      fontFamily: "var(--font-ui)",
      fontSize: "16px",
      color: "var(--color-ink)",
      background: "var(--color-canvas)",
      borderRadius: "var(--radius-md)",
      padding: "12px 16px",
      border: error ? "2px solid var(--color-primary-deep)" : focused ? "2px solid var(--color-primary)" : "1px solid var(--color-hairline-strong)",
      outline: "none",
      transition: "border-color var(--dur-fast) var(--ease-standard)",
      ...style
    }
  }, rest)), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
      color: "var(--color-primary-deep)"
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
      color: "var(--color-steel)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Native select styled to match Input. Pass options as [{value,label}] or children.
 */
function Select({
  label,
  hint,
  id,
  options,
  children,
  style,
  wrapperStyle,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || (label ? "sel-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      ...wrapperStyle
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      fontWeight: 500,
      color: "var(--color-ink)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: inputId,
    onFocus: e => {
      setFocused(true);
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      setFocused(false);
      rest.onBlur && rest.onBlur(e);
    },
    style: {
      width: "100%",
      height: "44px",
      appearance: "none",
      WebkitAppearance: "none",
      fontFamily: "var(--font-ui)",
      fontSize: "16px",
      color: "var(--color-ink)",
      background: "var(--color-canvas)",
      borderRadius: "var(--radius-md)",
      padding: "12px 40px 12px 16px",
      border: focused ? "2px solid var(--color-primary)" : "1px solid var(--color-hairline-strong)",
      outline: "none",
      cursor: "pointer",
      ...style
    }
  }, rest), options ? options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)) : children), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "var(--color-steel)",
      fontSize: "12px"
    }
  }, "\u25BE")), hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
      color: "var(--color-steel)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Multi-line text area. Matches Input styling; min 3 rows.
 */
function Textarea({
  label,
  hint,
  id,
  rows = 4,
  style,
  wrapperStyle,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || (label ? "ta-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      ...wrapperStyle
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      fontWeight: 500,
      color: "var(--color-ink)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("textarea", _extends({
    id: inputId,
    rows: rows,
    onFocus: e => {
      setFocused(true);
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      setFocused(false);
      rest.onBlur && rest.onBlur(e);
    },
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "16px",
      lineHeight: 1.55,
      color: "var(--color-ink)",
      background: "var(--color-canvas)",
      borderRadius: "var(--radius-md)",
      padding: "16px",
      resize: "vertical",
      border: focused ? "2px solid var(--color-primary)" : "1px solid var(--color-hairline-strong)",
      outline: "none",
      transition: "border-color var(--dur-fast) var(--ease-standard)",
      ...style
    }
  }, rest)), hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
      color: "var(--color-steel)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PromoBanner.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Sticky black promo strip that sits ABOVE the top nav. One-line copy + inline CTA.
 */
function PromoBanner({
  children,
  ctaLabel,
  onCta,
  ctaHref,
  dismissible = false,
  style,
  ...rest
}) {
  const [open, setOpen] = React.useState(true);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      background: "var(--color-ink)",
      color: "var(--color-on-dark)",
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      fontWeight: 500,
      padding: "12px 16px",
      position: "relative",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", null, children), ctaLabel ? /*#__PURE__*/React.createElement("a", {
    href: ctaHref || "#",
    onClick: onCta,
    style: {
      color: "var(--color-sunshine-500)",
      fontWeight: 600,
      textDecoration: "underline",
      textUnderlineOffset: "3px"
    }
  }, ctaLabel) : null, dismissible ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(false),
    "aria-label": "\uB2EB\uAE30",
    style: {
      position: "absolute",
      right: "16px",
      background: "transparent",
      border: "none",
      color: "var(--color-on-dark-muted)",
      cursor: "pointer",
      fontSize: "16px",
      lineHeight: 1
    }
  }, "\xD7") : null);
}
Object.assign(__ds_scope, { PromoBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PromoBanner.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tab navigation. `variant="segmented"` = underline tabs (orange active border);
 * `variant="pill"` = pill tabs (ink active). Controlled via value/onChange or uncontrolled.
 */
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  variant = "segmented",
  style,
  ...rest
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = value !== undefined ? value : internal;
  const select = v => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };
  if (variant === "pill") {
    return /*#__PURE__*/React.createElement("div", _extends({
      style: {
        display: "inline-flex",
        gap: "8px",
        flexWrap: "wrap",
        ...style
      }
    }, rest), items.map(it => {
      const on = it.value === active;
      return /*#__PURE__*/React.createElement("button", {
        key: it.value,
        type: "button",
        onClick: () => select(it.value),
        style: {
          fontFamily: "var(--font-ui)",
          fontSize: "14px",
          fontWeight: 500,
          padding: "8px 16px",
          borderRadius: "var(--radius-full)",
          cursor: "pointer",
          transition: "all var(--dur-fast) var(--ease-standard)",
          background: on ? "var(--color-ink)" : "var(--color-canvas)",
          color: on ? "var(--color-on-dark)" : "var(--color-steel)",
          border: on ? "1px solid var(--color-ink)" : "1px solid var(--color-hairline)"
        }
      }, it.label);
    }));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      gap: "4px",
      borderBottom: "1px solid var(--color-hairline)",
      ...style
    }
  }, rest), items.map(it => {
    const on = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      type: "button",
      onClick: () => select(it.value),
      style: {
        fontFamily: "var(--font-ui)",
        fontSize: "14px",
        fontWeight: 500,
        padding: "12px 16px",
        background: "transparent",
        cursor: "pointer",
        border: "none",
        borderBottom: on ? "2px solid var(--color-primary)" : "2px solid transparent",
        marginBottom: "-1px",
        color: on ? "var(--color-primary)" : "var(--color-steel)",
        transition: "color var(--dur-fast) var(--ease-standard)"
      }
    }, it.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/signature/HeroBand.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Atmospheric sunset hero band. Headline left in the editorial display face,
 * subtitle + action row beneath; an atmospheric sunset-sky panel on the right.
 * Pass `media` (e.g. an <image-slot> or <img>) to fill the right panel.
 */
function HeroBand({
  eyebrow,
  title,
  subtitle,
  actions,
  media,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      position: "relative",
      overflow: "hidden",
      background: "var(--sunset-sky)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-hero) var(--container-gutter)",
      display: "grid",
      gridTemplateColumns: media ? "minmax(0, 1.1fr) minmax(0, 0.9fr)" : "1fr",
      gap: "var(--space-xxxl)",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-lg)",
      maxWidth: "640px"
    }
  }, eyebrow ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "11px",
      fontWeight: 600,
      letterSpacing: "1px",
      textTransform: "uppercase",
      color: "var(--color-ink-tint)"
    }
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: "84px",
      lineHeight: 1.05,
      letterSpacing: "-1.5px",
      color: "var(--color-ink)",
      fontWeight: 400
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-ui)",
      fontSize: "18px",
      lineHeight: 1.5,
      color: "var(--color-ink-tint)",
      maxWidth: "48ch"
    }
  }, subtitle) : null, actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "8px"
    }
  }, actions) : null), media ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      aspectRatio: "4 / 3",
      boxShadow: "var(--shadow-3)"
    }
  }, media) : null));
}
Object.assign(__ds_scope, { HeroBand });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/signature/HeroBand.jsx", error: String((e && e.message) || e) }); }

// components/signature/SunsetStripe.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The Wolf sunset stripe — a full-width horizontal gradient band
 * (orange → sunshine → yellow → cream) that closes every page above the footer.
 * THE brand's most recognizable signature element. Never drop it.
 */
function SunsetStripe({
  height = 14,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    "aria-hidden": "true",
    style: {
      width: "100%",
      height: typeof height === "number" ? height + "px" : height,
      background: "var(--sunset-stripe)",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { SunsetStripe });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/signature/SunsetStripe.jsx", error: String((e && e.message) || e) }); }

// components/signature/CtaBanner.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Cream-tinted page CTA band. "다음 무대는 당신 차례." editorial headline + actions.
 * Set `withStripe` to prepend the signature sunset stripe.
 */
function CtaBanner({
  title,
  subtitle,
  actions,
  withStripe = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%"
    }
  }, withStripe ? /*#__PURE__*/React.createElement(__ds_scope.SunsetStripe, null) : null, /*#__PURE__*/React.createElement("section", _extends({
    style: {
      background: "var(--color-cream)",
      color: "var(--color-ink)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section-lg) var(--container-gutter)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: "var(--space-lg)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: "52px",
      lineHeight: 1.15,
      letterSpacing: "-0.5px",
      fontWeight: 400,
      maxWidth: "16ch"
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-ui)",
      fontSize: "18px",
      lineHeight: 1.5,
      color: "var(--color-slate)",
      maxWidth: "48ch"
    }
  }, subtitle) : null, actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "8px"
    }
  }, actions) : null)));
}
Object.assign(__ds_scope, { CtaBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/signature/CtaBanner.jsx", error: String((e && e.message) || e) }); }

// components/signature/Footer.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DEFAULT_COLUMNS = [{
  heading: "둘러보기",
  links: ["전체 페스티벌", "이번 주말", "지역별", "장르별"]
}, {
  heading: "패스",
  links: ["1-DAY", "3-DAY", "VIP", "단체 예매"]
}, {
  heading: "고객지원",
  links: ["자주 묻는 질문", "환불 정책", "문의하기", "공지사항"]
}, {
  heading: "회사",
  links: ["브랜드 소개", "채용", "제휴 문의", "약관"]
}];

/**
 * Cream multi-column footer, preceded by the signature sunset stripe.
 * The closing element of every Wolf page.
 */
function Footer({
  wordmark = "WOLF",
  tagline = "세상의 모든 페스티벌, 한 장의 패스로.",
  columns = DEFAULT_COLUMNS,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("footer", _extends({
    style: {
      width: "100%",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.SunsetStripe, null), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--color-footer-cream)",
      color: "var(--color-ink)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section) var(--container-gutter)",
      display: "grid",
      gridTemplateColumns: "1.4fr repeat(4, 1fr)",
      gap: "var(--space-xxxl)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "32px",
      letterSpacing: "0.5px",
      color: "var(--color-ink)"
    }
  }, wordmark), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      lineHeight: 1.5,
      color: "var(--color-slate)",
      maxWidth: "26ch"
    }
  }, tagline)), columns.map(col => /*#__PURE__*/React.createElement("div", {
    key: col.heading,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--color-ink)"
    }
  }, col.heading), col.links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: "var(--color-primary)",
      textDecoration: "none",
      padding: "4px 0"
    }
  }, l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "0 var(--container-gutter) var(--space-section)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "16px",
      fontFamily: "var(--font-ui)",
      fontSize: "12px",
      color: "var(--color-steel)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Wolf Festival Pass. All rights reserved."), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: "16px"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--color-steel)",
      textDecoration: "none"
    }
  }, "Instagram"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--color-steel)",
      textDecoration: "none"
    }
  }, "YouTube"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--color-steel)",
      textDecoration: "none"
    }
  }, "\uD55C\uAD6D\uC5B4 \u25BE")))));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/signature/Footer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/App.jsx
try { (() => {
// Wolf website — app shell wiring all screens together
function WolfApp() {
  const {
    Footer
  } = window.WolfDesignSystem_4d4911;
  const [route, setRoute] = React.useState("home");
  const [festival, setFestival] = React.useState(null);
  const [order, setOrder] = React.useState(null);
  const [ticket, setTicket] = React.useState(null);
  const go = r => {
    setRoute(r);
    window.scrollTo({
      top: 0
    });
  };
  const openFestival = f => {
    setFestival(f);
    go("detail");
  };
  const selectPass = (f, p, price) => {
    setOrder({
      festival: f,
      pass: p,
      price
    });
    go("checkout");
  };
  const confirm = o => {
    const orderId = "2026-" + String(Math.floor(Math.random() * 9000000) + 1000000);
    setTicket({
      ...o,
      orderId
    });
    go("wallet");
  };

  // re-render Lucide icons whenever the screen changes
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });
  const cartCount = order && route !== "wallet" ? 1 : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "var(--color-canvas)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(window.WolfNav, {
    route: route,
    onNavigate: go,
    cartCount: cartCount
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1
    }
  }, route === "home" && /*#__PURE__*/React.createElement(window.HomeScreen, {
    onNavigate: go,
    onOpenFestival: openFestival
  }), route === "browse" && /*#__PURE__*/React.createElement(window.BrowseScreen, {
    onOpenFestival: openFestival
  }), route === "detail" && /*#__PURE__*/React.createElement(window.DetailScreen, {
    festival: festival,
    onSelectPass: selectPass
  }), route === "checkout" && /*#__PURE__*/React.createElement(window.CheckoutScreen, {
    order: order,
    onConfirm: confirm,
    onNavigate: go
  }), route === "wallet" && /*#__PURE__*/React.createElement(window.WalletScreen, {
    ticket: ticket,
    onNavigate: go
  })), /*#__PURE__*/React.createElement(Footer, null));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(WolfApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/BrowseScreen.jsx
try { (() => {
// Browse / listing — header, filter bar, festival grid
function BrowseScreen({
  onOpenFestival
}) {
  const {
    Tabs,
    Select
  } = window.WolfDesignSystem_4d4911;
  const [genre, setGenre] = React.useState("all");
  const all = window.WOLF_FESTIVALS;
  const list = genre === "all" ? all : all.filter(f => f.genre === genre);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section) var(--container-gutter)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: "var(--color-stone)",
      marginBottom: 10
    }
  }, "FESTIVALS"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 28px",
      fontFamily: "var(--font-display)",
      fontSize: 56,
      lineHeight: 1.1,
      letterSpacing: -1,
      color: "var(--color-ink)",
      fontWeight: 400
    }
  }, "\uC804\uCCB4 \uD398\uC2A4\uD2F0\uBC8C"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: 28,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    variant: "pill",
    value: genre,
    onChange: setGenre,
    items: [{
      value: "all",
      label: "전체"
    }, {
      value: "EDM",
      label: "EDM"
    }, {
      value: "인디",
      label: "인디"
    }, {
      value: "힙합",
      label: "힙합"
    }, {
      value: "록",
      label: "록"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Select, {
    options: [{
      value: "all",
      label: "전 지역"
    }, {
      value: "seoul",
      label: "서울/경기"
    }, {
      value: "busan",
      label: "부산"
    }],
    wrapperStyle: {
      minWidth: 140
    }
  }), /*#__PURE__*/React.createElement(Select, {
    options: [{
      value: "soon",
      label: "다가오는 순"
    }, {
      value: "price",
      label: "가격 낮은 순"
    }, {
      value: "pop",
      label: "인기순"
    }],
    wrapperStyle: {
      minWidth: 150
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 20
    }
  }, list.map(f => /*#__PURE__*/React.createElement(window.FestivalCard, {
    key: f.id,
    festival: f,
    onOpen: onOpenFestival
  }))));
}
Object.assign(window, {
  BrowseScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/BrowseScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/CheckoutScreen.jsx
try { (() => {
// Checkout — order summary + cream contact/payment panel
function CheckoutScreen({
  order,
  onConfirm,
  onNavigate
}) {
  const {
    Input,
    Select,
    Button,
    Card
  } = window.WolfDesignSystem_4d4911;
  const [qty, setQty] = React.useState(1);
  if (!order) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--space-section-lg) var(--container-gutter)",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 44,
        letterSpacing: -1,
        color: "var(--color-ink)",
        fontWeight: 400
      }
    }, "\uC7A5\uBC14\uAD6C\uB2C8\uAC00 \uBE44\uC5B4\uC788\uC5B4\uC694"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontFamily: "var(--font-ui)",
        color: "var(--color-steel)",
        marginBottom: 24
      }
    }, "\uB9C8\uC74C\uC5D0 \uB4DC\uB294 \uD398\uC2A4\uD2F0\uBC8C\uC758 \uD328\uC2A4\uB97C \uBA3C\uC800 \uACE8\uB77C\uBCF4\uC138\uC694."), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      onClick: () => onNavigate("browse")
    }, "\uD398\uC2A4\uD2F0\uBC8C \uB458\uB7EC\uBCF4\uAE30"));
  }
  const {
    festival,
    pass,
    price
  } = order;
  const subtotal = price * qty;
  const fee = Math.round(subtotal * 0.03);
  const total = subtotal + fee;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section) var(--container-gutter)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 32px",
      fontFamily: "var(--font-display)",
      fontSize: 52,
      letterSpacing: -1,
      color: "var(--color-ink)",
      fontWeight: 400
    }
  }, "\uC608\uB9E4\uD558\uAE30"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.2fr 1fr",
      gap: 32,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "base",
    style: {
      padding: 0,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120,
      background: festival.sky
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 1,
      color: "var(--color-stone)"
    }
  }, festival.en), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 30,
      color: "var(--color-ink)",
      margin: "2px 0 4px"
    }
  }, festival.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 14,
      color: "var(--color-steel)",
      marginBottom: 24
    }
  }, festival.date, " \xB7 ", festival.location), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 0",
      borderTop: "1px solid var(--color-hairline)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 15,
      fontWeight: 600,
      color: "var(--color-ink)"
    }
  }, pass.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 13,
      color: "var(--color-steel)"
    }
  }, window.wolfWon(price), " ", pass.cadence)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setQty(Math.max(1, qty - 1)),
    style: qtyBtn
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 16,
      fontWeight: 600,
      minWidth: 18,
      textAlign: "center"
    }
  }, qty), /*#__PURE__*/React.createElement("button", {
    onClick: () => setQty(qty + 1),
    style: qtyBtn
  }, "+"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      paddingTop: 16,
      borderTop: "1px solid var(--color-hairline)"
    }
  }, /*#__PURE__*/React.createElement(Row, {
    label: "\uD328\uC2A4 \uAE08\uC561",
    value: window.wolfWon(subtotal)
  }), /*#__PURE__*/React.createElement(Row, {
    label: "\uC608\uB9E4 \uC218\uC218\uB8CC",
    value: window.wolfWon(fee)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 16,
      fontWeight: 600,
      color: "var(--color-ink)"
    }
  }, "\uCD1D \uACB0\uC81C\uAE08\uC561"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 34,
      letterSpacing: -1,
      color: "var(--color-primary)"
    }
  }, window.wolfWon(total)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--color-cream)",
      border: "1px solid var(--color-beige-deep)",
      borderRadius: "var(--radius-lg)",
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 20px",
      fontFamily: "var(--font-ui)",
      fontSize: 22,
      fontWeight: 600,
      color: "var(--color-ink)"
    }
  }, "\uC608\uB9E4\uC790 \uC815\uBCF4"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "\uC774\uB984",
    placeholder: "\uD64D\uAE38\uB3D9",
    style: {
      background: "#fff"
    }
  }), /*#__PURE__*/React.createElement(Input, {
    label: "\uC774\uBA54\uC77C",
    placeholder: "you@example.com",
    hint: "\uC804\uC790 \uD328\uC2A4\uAC00 \uC774 \uBA54\uC77C\uB85C \uBC1C\uC1A1\uB429\uB2C8\uB2E4",
    style: {
      background: "#fff"
    }
  }), /*#__PURE__*/React.createElement(Input, {
    label: "\uD734\uB300\uD3F0 \uBC88\uD638",
    placeholder: "010-0000-0000",
    style: {
      background: "#fff"
    }
  }), /*#__PURE__*/React.createElement(Select, {
    label: "\uACB0\uC81C \uBC29\uBC95",
    style: {
      background: "#fff"
    },
    options: [{
      value: "card",
      label: "신용 / 체크카드"
    }, {
      value: "kakao",
      label: "카카오페이"
    }, {
      value: "naver",
      label: "네이버페이"
    }, {
      value: "toss",
      label: "토스페이"
    }]
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "dark",
    size: "lg",
    fullWidth: true,
    onClick: () => onConfirm({
      festival,
      pass,
      price,
      qty,
      total
    }),
    style: {
      marginTop: 8
    }
  }, window.wolfWon(total), " \uACB0\uC81C\uD558\uAE30"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      color: "var(--color-steel)",
      textAlign: "center",
      margin: 0
    }
  }, "\uACB0\uC81C \uC2DC \uC774\uC6A9\uC57D\uAD00 \uBC0F \uD658\uBD88 \uC815\uCC45\uC5D0 \uB3D9\uC758\uD558\uAC8C \uB429\uB2C8\uB2E4.")))));
}
function Row({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--font-ui)",
      fontSize: 14,
      color: "var(--color-slate)"
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", null, value));
}
const qtyBtn = {
  width: 32,
  height: 32,
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-hairline-strong)",
  background: "#fff",
  cursor: "pointer",
  fontSize: 18,
  color: "var(--color-ink)",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};
Object.assign(window, {
  CheckoutScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/CheckoutScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/DetailScreen.jsx
try { (() => {
// Festival detail — hero banner, tabs (lineup/info/map), pass tiers
function DetailScreen({
  festival,
  onSelectPass
}) {
  const {
    Tabs,
    Badge,
    PassCard,
    Card
  } = window.WolfDesignSystem_4d4911;
  const f = festival;
  const [tab, setTab] = React.useState("lineup");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      background: f.sky
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg,transparent 30%,rgba(0,0,0,.45))"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section-lg) var(--container-gutter) var(--space-section)",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "orange"
  }, f.genre), f.tag ? /*#__PURE__*/React.createElement(Badge, {
    variant: "dark"
  }, f.tag) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 1,
      color: "rgba(255,255,255,.85)",
      marginBottom: 8
    }
  }, f.en), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 18px",
      fontFamily: "var(--font-display)",
      fontSize: 76,
      lineHeight: 1.05,
      letterSpacing: -1.5,
      fontWeight: 400
    }
  }, f.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 24,
      fontFamily: "var(--font-ui)",
      fontSize: 15
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "calendar",
    style: {
      width: 18,
      height: 18
    }
  }), " ", f.date), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "map-pin",
    style: {
      width: 18,
      height: 18
    }
  }), " ", f.location)))), /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section) var(--container-gutter)"
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      value: "lineup",
      label: "라인업"
    }, {
      value: "info",
      label: "안내"
    }, {
      value: "map",
      label: "오시는 길"
    }],
    style: {
      marginBottom: 32
    }
  }), tab === "lineup" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 18,
      lineHeight: 1.5,
      color: "var(--color-slate)",
      maxWidth: "56ch",
      marginTop: 0
    }
  }, f.blurb), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 14,
      marginTop: 24
    }
  }, f.lineup.map((a, i) => /*#__PURE__*/React.createElement(Card, {
    key: a,
    variant: "base",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 28,
      color: "var(--color-primary)",
      minWidth: 34
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 17,
      fontWeight: 600,
      color: "var(--color-ink)"
    }
  }, a))))), tab === "info" && /*#__PURE__*/React.createElement(Card, {
    variant: "cream-soft",
    style: {
      maxWidth: 720
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 16,
      lineHeight: 1.7,
      color: "var(--color-slate)",
      margin: 0
    }
  }, "\xB7 \uC785\uC7A5: \uAC8C\uC774\uD2B8 \uC624\uD508 14:00 / \uACF5\uC5F0 \uC2DC\uC791 16:00", /*#__PURE__*/React.createElement("br", null), "\xB7 \uC7AC\uC785\uC7A5: 3-DAY \uC774\uC0C1 \uD328\uC2A4 \uC18C\uC9C0 \uC2DC \uAC00\uB2A5", /*#__PURE__*/React.createElement("br", null), "\xB7 \uC6B0\uCC9C \uC2DC\uC5D0\uB3C4 \uC815\uC0C1 \uC9C4\uD589\uB418\uBA70, \uCC9C\uC7AC\uC9C0\uBCC0 \uC678 \uD658\uBD88\uC740 \uBD88\uAC00\uD569\uB2C8\uB2E4.", /*#__PURE__*/React.createElement("br", null), "\xB7 \uB9CC 19\uC138 \uBBF8\uB9CC\uC740 \uBCF4\uD638\uC790 \uB3D9\uBC18\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.")), tab === "map" && /*#__PURE__*/React.createElement(Card, {
    variant: "base",
    style: {
      padding: 0,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 320,
      background: "linear-gradient(135deg,#fff0c2,#ffd06a)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--color-ink-tint)",
      fontFamily: "var(--font-ui)",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "map-pin",
    style: {
      width: 22,
      height: 22
    }
  }), " ", f.location)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 64
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 28px",
      fontFamily: "var(--font-display)",
      fontSize: 44,
      letterSpacing: -1,
      color: "var(--color-ink)",
      fontWeight: 400
    }
  }, "\uD328\uC2A4 \uC120\uD0DD"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 20,
      alignItems: "stretch",
      paddingTop: 14
    }
  }, window.WOLF_PASSES.map(p => {
    const price = Math.round(f.from * p.mult / 1000) * 1000;
    return /*#__PURE__*/React.createElement(PassCard, {
      key: p.id,
      name: p.name,
      price: window.wolfWon(price),
      cadence: p.cadence,
      description: p.desc,
      badge: p.badge,
      featured: p.featured,
      perks: p.perks,
      cta: "\uD328\uC2A4 \uAD6C\uB9E4",
      onSelect: () => onSelectPass(f, p, price)
    });
  })))));
}
Object.assign(window, {
  DetailScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/DetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/FestivalCard.jsx
try { (() => {
// Festival listing card — gradient "sky" media + meta + from-price
function FestivalCard({
  festival,
  onOpen
}) {
  const {
    Badge
  } = window.WolfDesignSystem_4d4911;
  const f = festival;
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpen(f),
    style: {
      display: "flex",
      flexDirection: "column",
      textAlign: "left",
      padding: 0,
      background: "var(--color-canvas)",
      border: "1px solid var(--color-hairline-soft)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      cursor: "pointer",
      transition: "box-shadow var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard)"
    },
    onMouseEnter: e => {
      e.currentTarget.style.boxShadow = "var(--shadow-2)";
      e.currentTarget.style.transform = "translateY(-2px)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.transform = "none";
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      aspectRatio: "16 / 10",
      background: f.sky
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.35))"
    }
  }), f.tag ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 14,
      left: 14
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "dark"
  }, f.tag)) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 16,
      bottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 1,
      color: "rgba(255,255,255,.85)"
    }
  }, f.en), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 30,
      lineHeight: 1.05,
      color: "#fff"
    }
  }, f.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      color: "var(--color-steel)",
      fontFamily: "var(--font-ui)",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "calendar",
    style: {
      width: 15,
      height: 15
    }
  }), " ", f.date), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      color: "var(--color-steel)",
      fontFamily: "var(--font-ui)",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "map-pin",
    style: {
      width: 15,
      height: 15
    }
  }), " ", f.location), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      color: "var(--color-stone)"
    }
  }, "from "), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 18,
      fontWeight: 600,
      color: "var(--color-ink)"
    }
  }, window.wolfWon(f.from))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 13,
      fontWeight: 500,
      color: "var(--color-primary)"
    }
  }, "\uC790\uC138\uD788 \u2192"))));
}
Object.assign(window, {
  FestivalCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/FestivalCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/HomeScreen.jsx
try { (() => {
// Homepage — hero, featured festivals, stats, closing CTA
function HomeScreen({
  onNavigate,
  onOpenFestival
}) {
  const {
    HeroBand,
    Button,
    StatCell,
    CtaBanner
  } = window.WolfDesignSystem_4d4911;
  const featured = window.WOLF_FESTIVALS;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HeroBand, {
    eyebrow: "2026 SUMMER \u2014 AUTUMN",
    title: /*#__PURE__*/React.createElement(React.Fragment, null, "\uD574\uAC00 \uC9C0\uBA74,", /*#__PURE__*/React.createElement("br", null), "\uBB34\uB300\uAC00 \uAE68\uC5B4\uB09C\uB2E4."),
    subtitle: "\uC138\uC0C1\uC758 \uBAA8\uB4E0 \uD398\uC2A4\uD2F0\uBC8C\uC744 \uD55C \uC7A5\uC758 \uD328\uC2A4\uB85C. \uAC80\uC0C9\uD558\uACE0, \uBE44\uAD50\uD558\uACE0, \uD55C \uBC88\uC5D0 \uC608\uB9E4\uD558\uC138\uC694.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "dark",
      size: "lg",
      onClick: () => onNavigate("browse")
    }, "\uD328\uC2A4 \uB458\uB7EC\uBCF4\uAE30"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "lg",
      onClick: () => onOpenFestival(featured[0])
    }, "\uB77C\uC778\uC5C5 \uBCF4\uAE30")),
    media: /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        height: "100%",
        background: "linear-gradient(160deg,#ff8a00,#fa520f 50%,#cc3a05)",
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,.45), transparent 45%)"
      }
    }))
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section-lg) var(--container-gutter)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: "var(--color-stone)",
      marginBottom: 10
    }
  }, "\uC774\uBC88 \uC2DC\uC98C \uB77C\uC778\uC5C5"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: 52,
      lineHeight: 1.1,
      letterSpacing: -1,
      color: "var(--color-ink)",
      fontWeight: 400
    }
  }, "\uACE7 \uB9CC\uB0A0 \uBB34\uB300\uB4E4")), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate("browse"),
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 14,
      fontWeight: 500,
      color: "var(--color-primary)",
      background: "none",
      border: "none",
      cursor: "pointer"
    }
  }, "\uC804\uCCB4 \uBCF4\uAE30 \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 20
    }
  }, featured.map(f => /*#__PURE__*/React.createElement(window.FestivalCard, {
    key: f.id,
    festival: f,
    onOpen: onOpenFestival
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--color-cream)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "var(--space-section) var(--container-gutter)",
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(StatCell, {
    value: "120K+",
    label: "\uB204\uC801 \uAD00\uAC1D"
  }), /*#__PURE__*/React.createElement(StatCell, {
    value: "48",
    label: "\uB77C\uC778\uC5C5 \uC544\uD2F0\uC2A4\uD2B8"
  }), /*#__PURE__*/React.createElement(StatCell, {
    value: "12",
    label: "\uC804\uAD6D \uD398\uC2A4\uD2F0\uBC8C"
  }), /*#__PURE__*/React.createElement(StatCell, {
    value: "99.4%",
    label: "\uC785\uC7A5 \uC131\uACF5\uB960"
  }))), /*#__PURE__*/React.createElement(CtaBanner, {
    withStripe: true,
    title: "\uB2E4\uC74C \uBB34\uB300\uB294 \uB2F9\uC2E0 \uCC28\uB840.",
    subtitle: "\uC5BC\uB9AC\uBC84\uB4DC \uD328\uC2A4\uB294 \uD55C\uC815 \uC218\uB7C9\uC785\uB2C8\uB2E4. \uB178\uC744\uC774 \uC9C0\uAE30 \uC804\uC5D0 \uC608\uB9E4\uD558\uC138\uC694.",
    actions: /*#__PURE__*/React.createElement(window.WolfDesignSystem_4d4911.Button, {
      variant: "primary",
      size: "lg",
      onClick: () => onNavigate("browse")
    }, "\uC9C0\uAE08 \uC608\uB9E4")
  }));
}
Object.assign(window, {
  HomeScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Nav.jsx
try { (() => {
// Wolf top navigation: promo banner + sticky white bar
function WolfNav({
  route,
  onNavigate,
  cartCount = 0
}) {
  const {
    PromoBanner
  } = window.WolfDesignSystem_4d4911;
  const links = [{
    id: "browse",
    label: "페스티벌"
  }, {
    id: "home",
    label: "라인업"
  }, {
    id: "home",
    label: "안내"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement(PromoBanner, {
    ctaLabel: "\uC9C0\uAE08 \uC608\uB9E4 \u2192",
    ctaHref: "#",
    onCta: e => {
      e.preventDefault();
      onNavigate("browse");
    },
    dismissible: true
  }, "\uD83C\uDF9F \uC5BC\uB9AC\uBC84\uB4DC \uD328\uC2A4 \uD55C\uC815 \uD310\uB9E4 \u2014 6\uC6D4 30\uC77C \uB9C8\uAC10"), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 64,
      padding: "0 32px",
      background: "var(--color-canvas)",
      borderBottom: "1px solid var(--color-hairline-soft)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 36
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate("home"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      background: "linear-gradient(180deg,#ff8a00,#fa520f 55%,#cc3a05)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 26,
      letterSpacing: 0.5,
      color: "var(--color-ink)",
      lineHeight: 1
    }
  }, "WOLF")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, links.map((l, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => onNavigate(l.id),
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 15,
      fontWeight: 500,
      color: "var(--color-slate)",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "6px 10px"
    }
  }, l.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    "aria-label": "\uAC80\uC0C9",
    style: iconBtn
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "search",
    style: {
      width: 20,
      height: 20
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate("wallet"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      fontFamily: "var(--font-ui)",
      fontSize: 14,
      fontWeight: 500,
      color: route === "wallet" ? "var(--color-primary)" : "var(--color-ink)",
      background: "none",
      border: "none",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "ticket",
    style: {
      width: 18,
      height: 18
    }
  }), " \uB0B4 \uD328\uC2A4"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate("checkout"),
    style: {
      ...iconBtn,
      position: "relative"
    },
    "aria-label": "\uC7A5\uBC14\uAD6C\uB2C8"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "shopping-bag",
    style: {
      width: 20,
      height: 20
    }
  }), cartCount > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -4,
      right: -6,
      minWidth: 16,
      height: 16,
      padding: "0 4px",
      borderRadius: 999,
      background: "var(--color-primary)",
      color: "#fff",
      fontSize: 10,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, cartCount)))));
}
const iconBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--color-ink)"
};
Object.assign(window, {
  WolfNav
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Nav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WalletScreen.jsx
try { (() => {
// My Passes wallet — dark ticket card with a (faux) QR + order details
function WalletScreen({
  ticket,
  onNavigate
}) {
  const {
    Badge,
    Button
  } = window.WolfDesignSystem_4d4911;
  if (!ticket) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--space-section-lg) var(--container-gutter)",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: "var(--font-display)",
        fontSize: 44,
        letterSpacing: -1,
        color: "var(--color-ink)",
        fontWeight: 400
      }
    }, "\uC544\uC9C1 \uD328\uC2A4\uAC00 \uC5C6\uC5B4\uC694"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontFamily: "var(--font-ui)",
        color: "var(--color-steel)",
        marginBottom: 24
      }
    }, "\uCCAB \uD398\uC2A4\uD2F0\uBC8C \uD328\uC2A4\uB97C \uC608\uB9E4\uD558\uBA74 \uC774\uACF3\uC5D0 \uBCF4\uAD00\uB429\uB2C8\uB2E4."), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      onClick: () => onNavigate("browse")
    }, "\uD398\uC2A4\uD2F0\uBC8C \uB458\uB7EC\uBCF4\uAE30"));
  }
  const {
    festival,
    pass,
    qty,
    orderId
  } = ticket;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: "0 auto",
      padding: "var(--space-section) var(--container-gutter)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: "var(--color-stone)",
      marginBottom: 10
    }
  }, "MY PASSES"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 8px",
      fontFamily: "var(--font-display)",
      fontSize: 52,
      letterSpacing: -1,
      color: "var(--color-ink)",
      fontWeight: 400
    }
  }, "\uB0B4 \uD328\uC2A4"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-ui)",
      color: "var(--color-steel)",
      marginTop: 0,
      marginBottom: 32
    }
  }, "\uC608\uB9E4\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC785\uC7A5 \uAC8C\uC774\uD2B8\uC5D0\uC11C QR\uC744 \uC2A4\uCE94\uD558\uC138\uC694."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      boxShadow: "var(--shadow-3)",
      background: "var(--color-surface-code)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      background: "var(--sunset-stripe)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 24,
      padding: 32,
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-ui)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 1,
      color: "var(--color-sunshine-500)"
    }
  }, festival.en), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 38,
      lineHeight: 1.05
    }
  }, festival.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "orange"
  }, pass.name), /*#__PURE__*/React.createElement(Badge, {
    variant: "dark"
  }, "x", qty)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontFamily: "var(--font-ui)",
      fontSize: 14,
      color: "rgba(255,255,255,.75)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "calendar",
    style: {
      width: 16,
      height: 16
    }
  }), " ", festival.date), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "map-pin",
    style: {
      width: 16,
      height: 16
    }
  }), " ", festival.location)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      color: "var(--color-on-dark-muted)",
      marginTop: 4
    }
  }, "ORDER #", orderId)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FauxQR, {
    seed: orderId
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--color-on-dark-muted)"
    }
  }, "SCAN AT GATE")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => onNavigate("home")
  }, "\uD648\uC73C\uB85C"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => onNavigate("browse")
  }, "\uB2E4\uB978 \uD398\uC2A4\uD2F0\uBC8C \uBCF4\uAE30")));
}

// Deterministic faux-QR rendered as a CSS grid (no external dependency)
function FauxQR({
  seed = "WOLF"
}) {
  const n = 21;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = h * 31 + seed.charCodeAt(i) >>> 0;
  const cells = [];
  for (let i = 0; i < n * n; i++) {
    h = h * 1103515245 + 12345 >>> 0;
    cells.push(h >> 16 & 1);
  }
  const finder = (r, c) => r < 7 && c < 7 || r < 7 && c >= n - 7 || r >= n - 7 && c < 7;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      padding: 12,
      borderRadius: "var(--radius-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${n}, 7px)`,
      gridAutoRows: "7px"
    }
  }, cells.map((v, i) => {
    const r = Math.floor(i / n),
      c = i % n;
    const on = finder(r, c) ? true : v === 1;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        width: 7,
        height: 7,
        background: on ? "#1c1c1e" : "#fff"
      }
    });
  })));
}
Object.assign(window, {
  WalletScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WalletScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/data.js
try { (() => {
// Wolf website — shared sample data + tiny helpers (window globals)
const WOLF_FESTIVALS = [{
  id: "sunset-wave",
  name: "선셋 웨이브",
  en: "SUNSET WAVE",
  genre: "EDM",
  date: "2026.07.31 – 08.02",
  short: "07.31",
  location: "부산 다대포 해변",
  from: 120000,
  sky: "linear-gradient(150deg,#ff8a00,#fa520f 55%,#cc3a05)",
  tag: "얼리버드",
  lineup: ["ALOK", "Peggy Gou", "Yaeji", "250", "Hyukoh", "PALMS"],
  blurb: "해변 위로 해가 지면, 베이스가 차오른다. 3일간의 일렉트로닉 항해."
}, {
  id: "golden-hour",
  name: "골든 아워",
  en: "GOLDEN HOUR",
  genre: "인디",
  date: "2026.09.12 – 09.13",
  short: "09.12",
  location: "서울 난지한강공원",
  from: 95000,
  sky: "linear-gradient(150deg,#ffb83e,#ff8105 60%,#fa520f)",
  tag: "라인업 공개",
  lineup: ["검정치마", "새소년", "잔나비", "실리카겔", "ADOY", "웬디"],
  blurb: "노을과 함께 흐르는 인디 사운드. 가장 따뜻한 가을의 하루."
}, {
  id: "midnight-howl",
  name: "미드나잇 하울",
  en: "MIDNIGHT HOWL",
  genre: "힙합",
  date: "2026.08.22 – 08.23",
  short: "08.22",
  location: "인천 영종도 스카이파크",
  from: 110000,
  sky: "linear-gradient(150deg,#ffd06a,#ffa110 55%,#ff8105)",
  tag: "매진 임박",
  lineup: ["사이먼 도미닉", "이영지", "비오", "Crush", "주석", "릴러말즈"],
  blurb: "달이 뜨면 늑대가 운다. 밤을 새우는 힙합 라인업."
}, {
  id: "amber-fields",
  name: "앰버 필즈",
  en: "AMBER FIELDS",
  genre: "록",
  date: "2026.10.03 – 10.04",
  short: "10.03",
  location: "경기 가평 자라섬",
  from: 105000,
  sky: "linear-gradient(150deg,#ffd900,#ffb83e 55%,#ff8a00)",
  tag: "",
  lineup: ["넬", "잔나비", "데이식스", "쏜애플", "터치드", "QWER"],
  blurb: "황금빛 들판에서 울리는 기타. 가을 록 페스티벌의 정점."
}];
const WOLF_PASSES = [{
  id: "1day",
  name: "1-DAY PASS",
  mult: 1,
  cadence: "/ 1일권",
  featured: false,
  desc: "하루를 가장 가볍게",
  badge: "",
  perks: ["선택한 1일 입장", "스탠딩 구역", "앱 디지털 패스"]
}, {
  id: "3day",
  name: "3-DAY PASS",
  mult: 2.4,
  cadence: "/ 3일권",
  featured: true,
  desc: "가장 인기 있는 선택",
  badge: "BEST VALUE",
  perks: ["3일 전체 입장", "전용 라운지 이용", "한정 굿즈 키트", "재입장 무제한"]
}, {
  id: "vip",
  name: "VIP PASS",
  mult: 4.9,
  cadence: "/ 3일권",
  featured: false,
  desc: "무대 앞, 모든 것",
  badge: "",
  perks: ["VIP 스탠딩 구역", "백스테이지 투어", "웰컴 드링크 & 발렛", "전용 입장 게이트"]
}];
function wolfWon(n) {
  return "₩" + n.toLocaleString("ko-KR");
}
Object.assign(window, {
  WOLF_FESTIVALS,
  WOLF_PASSES,
  wolfWon
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.PassCard = __ds_scope.PassCard;

__ds_ns.StatCell = __ds_scope.StatCell;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.PromoBanner = __ds_scope.PromoBanner;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.CtaBanner = __ds_scope.CtaBanner;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.HeroBand = __ds_scope.HeroBand;

__ds_ns.SunsetStripe = __ds_scope.SunsetStripe;

})();
