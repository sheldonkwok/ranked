import { cva } from "@/lib/cva";

// Four flavors of pixel button. Not a base+modifier system — none of
// `gold`/`outline`/`ghost` are ever combined with a bare "button" look, so
// each variant carries its own full padding/font/border set rather than
// layering onto a shared base.
export const button = cva("cursor-pointer whitespace-nowrap font-sans tracking-[1px] duration-100", {
  variants: {
    variant: {
      // Secondary nav/utility button (Twitch/Steam link CTAs).
      nav: "border border-edge/45 bg-(image:--gradient-btn-nav) px-3.5 py-[9px] text-[14px] text-[#dce8ff] transition-[color,border-color,background] hover:border-white hover:bg-(image:--gradient-btn-nav-hover) hover:text-white",
      // Primary CTA — gold gradient.
      gold: "border border-gold-pale bg-(image:--gradient-btn-gold) px-[18px] py-3.5 text-[14px] font-bold text-[#14100a] transition-[background] active:translate-y-0.5 hover:bg-(image:--gradient-btn-gold-hover)",
      // Transparent 2px-outline action — EntryDialog's destructive buttons,
      // which sit muted until hover reveals the danger tint.
      outline:
        "border-2 border-[#333b5e] bg-transparent px-2.5 py-[3px] font-pixel text-[18px] leading-none text-[#8d9ac8] transition-[color,border-color] hover:border-[#8a3a4d] hover:text-[#ffb4c0]",
      // Small inline text-style action (SIGN OUT / modal chrome).
      ghost:
        "border border-edge/30 bg-white/6 px-2.5 py-2 text-[11px] text-ink-muted transition-[color,border-color] disabled:cursor-not-allowed disabled:opacity-50 hover:border-white hover:text-white",
    },
    tone: {
      danger: "hover:border-danger hover:text-danger-ink",
    },
  },
  defaultVariants: { variant: "ghost" },
});

// Bare icon CTA — same gold as the `gold` button variant, no fill/border.
// The Plus/Share header icons have no padding, so their hit area is
// literally the SVG's own box (24x24, 20x20) — below the 44px touch-target
// floor. `mobile:min-h-11 mobile:min-w-11` widens the tappable area without
// changing the icon size; call sites already carry `flex items-center` to
// center it. `data-state="active"` is the toggled-on look for icon buttons
// that are a mode switch rather than a one-shot action (e.g. the /add Steam
// library toggle).
export const iconButton = cva(
  "cursor-pointer text-gold transition-colors duration-100 data-[state=active]:text-gold-pale active:translate-y-0.5 hover:text-gold-pale mobile:min-h-11 mobile:min-w-11 mobile:justify-center"
);
