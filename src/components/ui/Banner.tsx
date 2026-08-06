import { cva, type VariantProps } from "@/lib/cva";

const banner = cva("border px-3 py-3 text-sm", {
  variants: {
    variant: {
      error: "border-disliked/50 bg-disliked/15 text-disliked-edge",
      warn: "border-fine/50 bg-fine/15 text-fine-edge",
    },
  },
});

export default function Banner({
  variant,
  children,
}: {
  variant: NonNullable<VariantProps<typeof banner>["variant"]>;
  children: React.ReactNode;
}) {
  return <div className={banner({ variant })}>{children}</div>;
}
