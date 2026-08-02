const VARIANT_STYLES = {
  error: "border-disliked/50 bg-disliked/15 text-disliked-edge",
  warn: "border-fine/50 bg-fine/15 text-fine-edge",
} as const;

export default function Banner({
  variant,
  children,
}: {
  variant: keyof typeof VARIANT_STYLES;
  children: React.ReactNode;
}) {
  return <div className={`border px-3 py-3 text-sm ${VARIANT_STYLES[variant]}`}>{children}</div>;
}
