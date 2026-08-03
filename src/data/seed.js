/**
 * The bundled seed shown on a cold first paint, before the live feed loads.
 *
 * Empty by design: the Discover feed shows only coins launched through eska.fun
 * (plus an optional official pin set via OFFICIAL_TOKEN), and no token is
 * hardcoded here. The grid shows a brief skeleton, then the live /api/launches
 * feed fills it in.
 */
export const SEED_TOKENS = []
