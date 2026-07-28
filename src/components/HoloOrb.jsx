import { forwardRef } from 'react'

/**
 * Holographic spectrum orb — image-2's iridescent color-wheel, rebuilt in layers:
 *   bloom halo · orbital ring · conic spectrum sphere · volume shade ·
 *   glass specular · foil grain · sweeping sheen · orbiting spark.
 * `tiltRef` receives the sphere group so the parent can drive mouse tilt.
 * Reads --px/--py from an ancestor for parallax on the halo + highlight.
 */
const HoloOrb = forwardRef(function HoloOrb({ size = 300 }, tiltRef) {
  const s = size
  return (
    <div className="relative grid place-items-center" style={{ width: s * 1.7, height: s * 1.7 }}>
      {/* spectral bloom aura — the glow that bleeds into the black */}
      <div
        className="absolute rounded-full pointer-events-none spinRev"
        style={{
          width: s * 1.42, height: s * 1.42,
          background: 'var(--holo)',
          filter: 'blur(58px) saturate(1.35)',
          opacity: 0.55,
          animation: 'spinRev 60s linear infinite',
          transform: 'translate(calc(var(--px,0px) * 0.5), calc(var(--py,0px) * 0.5))',
        }}
      />
      {/* faint outer orbital ring */}
      <div className="absolute rounded-full pointer-events-none spin-slow"
        style={{ width: s * 1.34, height: s * 1.34, border: '1px solid rgba(255,255,255,0.06)' }} />
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: s * 1.14, height: s * 1.14, border: '1px solid rgba(255,255,255,0.04)' }} />

      {/* the sphere group — parent tilts this */}
      <div ref={tiltRef} className="tilt floaty relative grid place-items-center"
        style={{ width: s, height: s, transformStyle: 'preserve-3d' }}>

        {/* conic spectrum disc, soft-masked into a glowing orb, hue slowly rotating */}
        <div className="orb-spin absolute inset-0 rounded-full"
          style={{
            background: 'var(--holo)',
            filter: 'saturate(1.28) brightness(1.06)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 52%, rgba(0,0,0,0.6) 64%, transparent 74%)',
            maskImage: 'radial-gradient(circle at 50% 50%, #000 52%, rgba(0,0,0,0.6) 64%, transparent 74%)',
          }} />

        {/* volume — darken the far edge so the disc reads as a sphere */}
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: s * 0.98, height: s * 0.98,
            background: 'radial-gradient(120% 120% at 34% 26%, transparent 38%, rgba(6,4,18,0.30) 68%, rgba(4,3,12,0.72) 100%)',
            mixBlendMode: 'multiply',
          }} />

        {/* foil grain over the sphere */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            backgroundImage: 'var(--grain)', backgroundSize: '96px 96px',
            mixBlendMode: 'overlay', opacity: 0.16,
            WebkitMaskImage: 'radial-gradient(circle, #000 60%, transparent 73%)',
            maskImage: 'radial-gradient(circle, #000 60%, transparent 73%)',
          }} />

        {/* sweeping sheen — a light crossing the glass */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <div className="absolute" style={{
            top: '-30%', left: '-30%', width: '160%', height: '160%',
            background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.55) 50%, transparent 58%)',
            transform: 'translateX(-140%)',
            animation: 'sheenSweep 6s ease-in-out 2s infinite',
          }} />
        </div>

        {/* glass specular highlight, drifts with the cursor */}
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: s * 0.4, height: s * 0.3,
            top: s * 0.12, left: s * 0.15,
            background: 'radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0.25) 42%, transparent 72%)',
            filter: 'blur(2px)', transform: 'translate(calc(var(--px,0px) * -0.4), calc(var(--py,0px) * -0.4)) rotate(-18deg)',
          }} />
        {/* tiny secondary catch-light */}
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: s * 0.09, height: s * 0.09, bottom: s * 0.2, right: s * 0.24,
            background: 'radial-gradient(closest-side, rgba(255,255,255,0.7), transparent)', filter: 'blur(1px)',
          }} />

        {/* rim light hugging the edge */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14), inset 8px 10px 26px rgba(255,255,255,0.14)' }} />
      </div>

      {/* one holographic spark orbiting the sphere */}
      <div className="absolute pointer-events-none" style={{ width: s * 1.34, height: s * 1.34, animation: 'spinSlow 18s linear infinite' }}>
        <span className="absolute rounded-full" style={{
          top: '4%', left: '50%', width: 9, height: 9, marginLeft: -4.5,
          background: 'radial-gradient(circle, #fff, #c9b8ff 60%, transparent)',
          boxShadow: '0 0 14px 3px rgba(200,180,255,0.9)',
        }} />
      </div>
    </div>
  )
})

export default HoloOrb
