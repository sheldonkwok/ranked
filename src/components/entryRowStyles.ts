// EntryRow's grid, shared with its loading skeleton so both track the same three-column geometry from one source; title track is `minmax(0,1fr)` so it's what gives when space is tight, and cover+title share one flex track (`entryLink`) since that pair is a single clickable unit.
export const entryRowGrid =
  "grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-4 px-[18px] py-3 mobile:grid-cols-[28px_minmax(0,1fr)_auto] mobile:gap-x-[11px] mobile:min-h-[68px] mobile:px-3 mobile:py-[9px] mobile-xs:grid-cols-[24px_minmax(0,1fr)_auto] mobile-xs:gap-x-[9px] mobile-xs:min-h-[66px] mobile-xs:px-2.5 mobile-xs:py-[9px]";

export const entryRank = "text-center text-[28px] mobile:text-[23px] mobile-xs:text-[20px]";

/** The cover+title cell — a flex row wrapped by either a plain `<div>` or a `<Link>`; only the `<Link>` variant needs the focus ring. */
export const entryLink = "flex min-w-0 items-center gap-4 mobile:gap-[11px] mobile-xs:gap-[9px]";
export const entryLinkFocus = "focus-visible:outline-4 focus-visible:outline-white focus-visible:-outline-offset-4";

export const entryCover = "h-14 w-[42px] mobile:h-[54px] mobile:w-10 mobile-xs:h-[46px] mobile-xs:w-[34px]";

export const entryName =
  "truncate text-[17px] tracking-[0.5px] mobile:line-clamp-3 mobile:text-clip mobile:text-pretty mobile:text-[18px] mobile:leading-[1.15] mobile:whitespace-normal mobile-xs:text-[16px]";

export const entryYear = "text-[16px] mobile:text-[15px] mobile-xs:text-[14px]";
