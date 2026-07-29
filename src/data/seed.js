/**
 * A tiny bundled roster of the established pons coins.
 *
 * It ships in the JS so the Discover grid can paint the instant the page opens —
 * recognisable coins with their spheres and tickers — while the real /api/launches
 * feed loads in the background and replaces every card with live prices and logos.
 * No network, no wait: the front page is never blank on a cold first visit.
 *
 * These mirror FEATURED_PONS in app/api/launches/route.js. They carry no price on
 * purpose; the live feed fills that in within a second or two.
 */
export const SEED_TOKENS = [
  { token: '0x39dBED3a2bd333467115dE45665cC57F813C4571', name: 'Pons', symbol: 'PONS', featured: true },
  { token: '0x62C71cd34a52c30d894419CBcc55Db2aFA8032eA', name: 'YOLO', symbol: 'YOLO', featured: true },
  { token: '0x45F82AC5d507e988f7406935da8eEfe495a360e0', name: 'Robinhood Dog', symbol: 'BRODIE', featured: true },
  { token: '0xA8aD8DAcbb2123458BD628e7De689524905bFcb7', name: 'Hoodlong', symbol: 'LONG', featured: true },
  { token: '0x2076CD26D8Cf26f91655d4Ada3dD2fdBFdd8e7a4', name: 'Apes', symbol: 'APES', featured: true },
  { token: '0xB0Fea401F1ee62F0e7cC3Bdf94b20c25aB5117e2', name: 'Motion', symbol: 'MOTION', featured: true },
  { token: '0x69984Ad3322300039f2855f81C44Dbc532EFe744', name: 'Tygr', symbol: 'TYGR', featured: true },
  { token: '0x9516922a56171AB9834b88864d1010a6D8633296', name: 'Artcoin', symbol: 'Artcoin', featured: true },
  { token: '0x9d98f99b0b6B2b7F99ab8BC187e1C59793eccb2c', name: 'PIPECAT', symbol: 'PIPECAT', featured: true },
  { token: '0x1aBf16f660CCbAa22CE8646deB1B63635D582228', name: 'Fonz on Pons', symbol: 'FONZ', featured: true },
  { token: '0x30dB03A051205CcBeb1B6524dDf87fbC6c0127bC', name: 'TA', symbol: 'TA', featured: true },
  { token: '0x8ECEA3d0E648DB646d824AA51EedeB16aC3d6878', name: 'wire', symbol: 'wire', featured: true },
]
