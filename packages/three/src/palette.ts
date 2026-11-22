/** Same values as packages/ui/src/styles/tokens.css ("ink and candlelight"). */
export const PALETTE = {
  bg: 0x0e0b14,
  panel: 0x1a1426,
  text: 0xedeaf7,
  muted: 0xb9b2d0,
  amber: 0xffb347,
  teal: 0x4fe3c1,
  violet: 0x8e7cff,
  red: 0xff5d73,
} as const;

/** Named colours the "turn that <colour>" command can apply. */
export const NAMED_COLORS: Record<string, number> = {
  red: 0xd9344a,
  orange: 0xff7a1a,
  yellow: 0xffd23f,
  gold: 0xffb347,
  green: 0x3fbf5f,
  teal: 0x4fe3c1,
  blue: 0x3b7bff,
  purple: 0x8e5cff,
  pink: 0xff6fb5,
  white: 0xf2efe9,
  black: 0x1b1720,
  grey: 0x8a8597,
  silver: 0xc9ccd6,
};
