/**
 * LEGO color names in Spanish.
 *
 * Rebrickable names are English and follow a pattern ("Dark Bluish Gray", "Trans-Light Blue", "Pearl Gold"),
 * so they are translated by parts: one base color plus shades, brightness, finishes and "transparent",
 * recombined in Spanish word order ("Gris azulado oscuro", "Azul claro transparente", "Oro perlado").
 *
 * A name with any word this does not know is returned UNCHANGED (English). A half-translated name such as
 * "Azul Foo" would be worse than an honest English one, and every unknown name is easy to add below.
 */

const BASE: Record<string, string> = {
  black: 'negro', white: 'blanco', red: 'rojo', blue: 'azul', green: 'verde', yellow: 'amarillo',
  orange: 'naranja', brown: 'marrón', gray: 'gris', grey: 'gris', pink: 'rosa', purple: 'morado',
  violet: 'violeta', tan: 'beige', lime: 'lima', magenta: 'magenta', turquoise: 'turquesa', azure: 'azur',
  aqua: 'aguamarina', lavender: 'lavanda', salmon: 'salmón', coral: 'coral', nougat: 'nougat',
  flesh: 'carne', gold: 'oro', silver: 'plata', copper: 'cobre', bronze: 'bronce', brass: 'latón',
  clear: 'transparente', cyan: 'cian', teal: 'verde azulado', maroon: 'granate', burgundy: 'burdeos',
  mint: 'menta', lemon: 'limón', rust: 'óxido', cream: 'crema', navy: 'azul marino', olive: 'oliva',
};
// words that qualify another color: "Olive Green", "Sand Blue", "Sky Blue"
const NOUN_MOD: Record<string, string> = { olive: 'oliva', sand: 'arena', sky: 'cielo', royal: 'real', warm: 'cálido', cool: 'frío' };
const SHADE: Record<string, string> = {
  bluish: 'azulado', greenish: 'verdoso', reddish: 'rojizo', yellowish: 'amarillento', pinkish: 'rosáceo',
  purplish: 'violáceo', brownish: 'pardo', grayish: 'grisáceo',
};
const BRIGHTNESS: Record<string, string> = {
  light: 'claro', lt: 'claro', dark: 'oscuro', dk: 'oscuro', medium: 'medio', med: 'medio', bright: 'brillante',
  very: 'muy', vibrant: 'vivo', pastel: 'pastel',
};
const FINISH: Record<string, string> = {
  pearl: 'perlado', metallic: 'metalizado', flat: 'mate', chrome: 'cromado', satin: 'satinado', milky: 'lechoso',
  glitter: 'con purpurina', opal: 'ópalo', neon: 'neón', fluorescent: 'fluorescente', rubber: 'de goma', opaque: 'opaco',
  speckle: 'moteado',
};
const BRAND: Record<string, string> = { fabuland: 'Fabuland', modulex: 'Modulex', ho: 'HO' };

// whole names that do not follow the pattern
const EXACT: Record<string, string> = {
  '[no color/any color]': '[Sin color / cualquier color]',
  '(not applicable)': '(No aplicable)',
  unknown: 'Desconocido',
  'glow in dark opaque': 'Brilla en la oscuridad (opaco)',
  'glow in dark white': 'Blanco que brilla en la oscuridad',
  'glow in dark trans': 'Transparente que brilla en la oscuridad',
  'dark blue-violet': 'Violeta azulado oscuro',
  'blue-violet': 'Violeta azulado',
  'trans-clear': 'Transparente',
  'glitter trans-clear': 'Transparente con purpurina',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function translate(name: string): string | null {
  const lower = name.trim().toLowerCase();
  if (EXACT[lower]) return EXACT[lower];

  // "Speckle Black-Silver" -> "Moteado negro y plata"
  const sp = /^speckle ([a-z]+)-([a-z]+)$/.exec(lower);
  if (sp) return BASE[sp[1]] && BASE[sp[2]] ? `Moteado ${BASE[sp[1]]} y ${BASE[sp[2]]}` : null;

  const tokens = lower.split(/[\s-]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let trans = false;
  const bases: string[] = [];
  const mods: string[] = [];
  const shades: string[] = [];
  const bright: string[] = [];
  const finish: string[] = [];
  const brand: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'trans' || t === 'transparent') { trans = true; continue; }
    // "Olive Green" / "Sand Blue": a qualifier followed by a color is a modifier, otherwise "olive" is the color itself
    if (NOUN_MOD[t] && BASE[tokens[i + 1] ?? '']) { mods.push(NOUN_MOD[t]); continue; }
    if (BASE[t]) { bases.push(t); continue; }
    if (SHADE[t]) { shades.push(SHADE[t]); continue; }
    if (BRIGHTNESS[t]) { bright.push(BRIGHTNESS[t]); continue; }
    if (FINISH[t]) { finish.push(FINISH[t]); continue; }
    if (BRAND[t]) { brand.push(BRAND[t]); continue; }
    return null; // a word we do not know: keep the original
  }
  if (bases.length !== 1) return null;

  const base = bases[0];
  const parts = [BASE[base], ...shades, ...mods, ...bright, ...finish];
  // "clear" already means transparent
  if (trans && base !== 'clear') parts.push('transparente');
  return cap(parts.join(' ')) + (brand.length ? ' ' + brand.join(' ') : '');
}

const cache = new Map<string, string>();

/** The Spanish name of a LEGO color, or the original name when it cannot be translated safely. */
export function colorNameEs(name: string): string {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const out = translate(name) ?? name;
  cache.set(name, out);
  return out;
}

/** Name for the current language ('es' translates; any other locale keeps the catalog's English). */
export function colorName(name: string | null | undefined, locale: string): string {
  if (!name) return '';
  return locale === 'es' ? colorNameEs(name) : name;
}
