/**
 * The bundled seed shown on a cold first paint, before the live feed loads.
 *
 * The Discover feed shows only coins launched through eska.fun (plus the official
 * $ESKA pin), so the seed is just $ESKA — the front page paints our own token
 * instantly and the real /api/launches feed fills in the rest of our launches a
 * second later. No network, no wait, and no pons coins flashing in first.
 */
export const SEED_TOKENS = [
  { token: '0x0eB9960654d3661D551a4536D7d425184eC81756', name: 'ESKA', symbol: 'ESKA', official: true },
]
