/**
 * Links to a set's building instructions. LEGO's PDFs are stored under internal asset ids
 * (.../product.bi.core.pdf/6196567.pdf), so a direct PDF link cannot be built from a set number; these
 * point to the pages that list them for that set: Rebrickable's instructions page (it links LEGO's own PDFs,
 * in every language and paper size they have) and LEGO's service page.
 */
export interface InstructionLink {
  key: 'rebrickable' | 'lego';
  url: string;
}

/** "75192-1" -> "75192" (LEGO's own numbering has no version suffix). */
export const baseSetNum = (setNum: string) => setNum.split('-')[0];

export function instructionLinks(setNum: string): InstructionLink[] {
  const n = encodeURIComponent(setNum);
  const base = encodeURIComponent(baseSetNum(setNum));
  return [
    { key: 'rebrickable', url: `https://rebrickable.com/instructions/${n}/` },
    { key: 'lego', url: `https://www.lego.com/en-us/service/buildinginstructions/${base}` },
  ];
}
