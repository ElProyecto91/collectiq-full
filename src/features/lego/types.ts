export interface LegoTheme {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface LegoSet {
  set_num: string;
  name: string;
  year: number | null;
  theme_id: number | null;
  num_parts: number | null;
  img_url: string | null;
}

/** A row of the lego_set_parts_full view. */
export interface LegoSetPart {
  set_num: string;
  part_num: string;
  color_id: number;
  quantity: number;
  is_spare: boolean;
  part_name: string;
  color_name: string;
  color_rgb: string | null;
  color_is_trans: boolean;
  img_url: string | null;
}

export interface LegoSearchParams {
  q: string;
  themeId: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  page: number;
}

export interface LegoSearchResult {
  sets: LegoSet[];
  total: number;
}

export interface LegoPartSummary {
  part_num: string;
  name: string;
}

export interface LegoColorOption {
  color_id: number;
  name: string;
  rgb: string | null;
  is_trans: boolean;
  /** Image of this part in this color, when the catalog has one. */
  img_url: string | null;
}

/** A part + color resolved against the catalog (name, color, image). */
export interface LegoPartDetail {
  part_num: string;
  color_id: number;
  part_name: string;
  color_name: string;
  color_rgb: string | null;
  color_is_trans: boolean;
  img_url: string | null;
}

export interface LegoPartKey {
  part_num: string;
  color_id: number;
}

export interface LegoPartItem extends LegoPartKey {
  quantity: number;
}

/** A row of user_lego_parts. */
export interface UserLegoPart extends LegoPartItem {
  updated_at: string;
}

export type LegoSetStatus = 'sealed' | 'open_complete' | 'incomplete';

export const LEGO_SET_STATUSES: readonly LegoSetStatus[] = ['sealed', 'open_complete', 'incomplete'];

/** A row of user_lego_sets: one owned copy of a set. */
export interface UserLegoSet {
  id: string;
  set_num: string;
  status: LegoSetStatus;
  price_paid: number | null;
  rrp: number | null;
  notes: string | null;
  created_at: string;
}

export interface UserLegoSetInput {
  set_num: string;
  status: LegoSetStatus;
  price_paid: number | null;
  rrp: number | null;
  notes: string | null;
}

export type RankingMetric = 'simple' | 'weighted';

export interface PossibleSetsParams {
  inventory: LegoPartItem[];
  metric: RankingMetric;
  /** Minimum percentage (0-1) on the chosen metric. */
  minPct: number;
  /** Minimum number of pieces already covered, to keep tiny sets from topping the list. */
  minCovered: number;
  limit: number;
}

export interface PossibleSet extends LegoSet {
  covered: number;
  total: number;
  /** Covered pieces / needed pieces (0-1). */
  pct: number;
  /** Same, weighting rarer parts more (0-1). */
  wpct: number;
}

export interface ProgressRow {
  key: string;
  /** A representative row of the group (name, color and image). */
  part: LegoSetPart;
  need: number;
  have: number;
  covered: number;
  missing: number;
}

export interface SetProgress {
  rows: ProgressRow[];
  total: number;
  covered: number;
  pct: number;
  /** null when the rarity weights are not available. */
  wpct: number | null;
}
