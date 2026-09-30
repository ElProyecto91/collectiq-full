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
