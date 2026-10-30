// Townaija design system, following the reference style:
// soft grey canvas, white rounded cards, round icon buttons, thin outline icons,
// lemon-yellow for the active / primary state, near-black for strong actions.
export const C = {
  bg: '#EDEDED',        // screen canvas
  white: '#FFFFFF',     // cards, buttons, tab bar
  soft: '#F6F6F6',      // tiles inside white cards
  line: '#E3E3E3',      // hairlines and outlined circles
  ink: '#141414',       // text, dark buttons
  black: '#141414',
  muted: '#6B6B6B',     // secondary text (passes 4.5:1 on the grey canvas)
  faint: '#A6A6A6',     // placeholders, inactive chevrons
  accent: '#F5EF3A',    // lemon yellow: active and primary
  accentDark: '#E2DB1C',
  onAccent: '#141414',
  green: '#1E9E5A',     // success
  greenSoft: '#E3F5EA',
  red: '#D93A3A',
  redSoft: '#FCE9E9',
  amber: '#9A6200',
  amberSoft: '#FFF3D6',
  blue: '#2F6BEA',
  blueSoft: '#E9EFFD',
  scrim: 'rgba(20,20,20,0.45)',
};

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  black: 'Inter_800ExtraBold',
};

// Corner radii: big cards are very round, tiles slightly less, controls are pills/circles.
export const R = { card: 28, tile: 22, input: 18, sm: 14, pill: 999 };
export const S = (n) => n * 4;
