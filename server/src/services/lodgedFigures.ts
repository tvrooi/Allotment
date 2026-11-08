// What a lodged year claimed (docs/TAX-CAR-AND-HOME.md decision 7): marking a year lodged records
// the working-from-home figures, and a later change shows as an amendment instead of being
// refused. Pure: no database (the writer is in taxCarHomeService.ts).

/** What one part claimed, as recorded when the year was marked lodged */
export interface LodgedPart {
  part: string;
  figures: { claim: number };
}
export interface CurrentPart {
  part: string;
  /** How the note names the part: "working from home" */
  label: string;
  figures: { claim: number; [input: string]: unknown };
}
export interface Amendment {
  part: string;
  label: string;
  /** The claim when lodged; null when the part was not recorded */
  lodgedClaim: number | null;
  claim: number;
  status: 'amended' | 'notRecorded';
  /** The wording for the year's note and the page's banner (amendmentNote) */
  note: string;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The one wording of an amendment, for the year's note and the page's banner */
export function amendmentNote(
  a: Pick<Amendment, 'label' | 'lodgedClaim' | 'claim' | 'status'>,
  yearName: string,
): string {
  return a.status === 'notRecorded'
    ? `${a.label.charAt(0).toUpperCase()}${a.label.slice(1)} wasn't recorded when ${yearName} was lodged.`
    : `Amended since lodging: ${a.label} was ${dollars(a.lodgedClaim ?? 0)}, now ${dollars(a.claim)}. Lodge an amendment with the ATO, then mark the year lodged again.`;
}

/**
 * Parts of a lodged year that differ from what was recorded. Unchanged parts are left out, and an
 * open year has none. A lodged year with no snapshot of a part that now has a claim is
 * `notRecorded` (lodged before the feature, or the part was added later).
 */
export function amendments(
  lodged: LodgedPart[],
  current: CurrentPart[],
  isLodged: boolean,
  yearName: string,
): Amendment[] {
  if (!isLodged) return [];
  const before = new Map(lodged.map((l) => [l.part, l.figures.claim]));
  return current.flatMap((c): Amendment[] => {
    const was = before.get(c.part);
    if (was === c.figures.claim) return [];
    if (was === undefined && c.figures.claim === 0) return [];
    const partial = {
      part: c.part,
      label: c.label,
      lodgedClaim: was ?? null,
      claim: c.figures.claim,
      status: was === undefined ? ('notRecorded' as const) : ('amended' as const),
    };
    return [{ ...partial, note: amendmentNote(partial, yearName) }];
  });
}
