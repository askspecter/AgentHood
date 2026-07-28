import { useEffect, useRef, useState } from 'react'
import HoloOrb from './HoloOrb'

/**
 * A real 3D holographic sphere rendered with WebGL.
 * The surface normal is reconstructed per-pixel, lit, and given a pastel
 * iridescent skin whose colour bands rotate around the ball over time —
 * so it reads as an actual spinning 3D orb, not a flat disc.
 * Fluid: the canvas fills its container (never wider than the viewport) and
 * the backing store follows the measured size. Reacts to the pointer,
 * auto-rotates, pauses off-screen, and falls back to CSS where WebGL is out.
 */

const VERT = `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;   // -1..1, eased
#define TAU 6.28318530718

mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,s, 0.,1.,0., -s,0.,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,-s, 0.,s,c); }

vec3 pal(float t){
  vec3 a = vec3(0.70, 0.68, 0.80);
  vec3 b = vec3(0.24, 0.25, 0.22);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.28, 0.52, 0.86);
  return a + b * cos(TAU * (c * t + d));
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.17))) * 43758.545); }

void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_res) / min(u_res.x, u_res.y);
  vec2 p  = uv / 0.60;
  float r2 = dot(p, p);

  vec3  col = vec3(0.0);
  float alpha = 0.0;

  float halo = smoothstep(2.6, 0.0, r2);
  float ang  = atan(p.y, p.x);
  vec3  hcol = pal(ang / TAU + u_time * 0.03);
  col   += hcol * halo * 0.40;
  alpha  = halo * 0.40;

  if (r2 < 1.0){
    float z = sqrt(1.0 - r2);
    vec3  N = vec3(p, z);
    vec3  V = vec3(0.0, 0.0, 1.0);

    mat3 rot = rotY(u_time * 0.42 + u_mouse.x * 1.0) * rotX(-0.32 + u_mouse.y * 0.7);
    vec3 S = rot * N;
    float lon = atan(S.z, S.x);
    float lat = asin(clamp(S.y, -1.0, 1.0));

    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);

    float t = lon / TAU + 0.16 * sin(lat * 3.0 + u_time * 0.6) + fres * 0.55 + u_time * 0.05;
    vec3 base  = pal(t);
    vec3 base2 = pal(t * 2.0 + 0.33 + fres);
    base = mix(base, base2, 0.35);

    vec3  L = normalize(vec3(-0.5, 0.72, 0.78));
    float diff  = clamp(dot(N, L), 0.0, 1.0);
    float shade = 0.55 + 0.55 * diff;
    vec3  H = normalize(L + V);
    float spec = pow(clamp(dot(N, H), 0.0, 1.0), 64.0);
    float rim  = pow(fres, 1.15);

    vec3 sphere = base * shade + spec * 1.15 + rim * hcol * 0.55;
    sphere += (hash(gl_FragCoord.xy + u_time) * 2.0 - 1.0) * 0.02;

    float edge = smoothstep(1.0, 0.982, r2);
    col   = mix(col, sphere, edge);
    alpha = max(alpha, edge);
  }

  col = pow(clamp(col, 0.0, 1.6), vec3(0.9));
  gl_FragColor = vec4(col * alpha, alpha);
}`

function compile(gl, type, src){
  const s = gl.createShader(type)
  gl.shaderSource(s, src); gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null }
  return s
}

export default function HoloSphere({ size = 300 }){
  const canvasRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const box = Math.round(size * 1.7)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
    if (!gl) { setFailed(true); return }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    const prog = gl.createProgram()
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setFailed(true); return }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uMouse = gl.getUniformLocation(prog, 'u_mouse')

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    function resize(){
      const cw = canvas.clientWidth || box
      const w = Math.max(1, Math.round(cw * dpr))
      if (canvas.width !== w) { canvas.width = w; canvas.height = w; gl.viewport(0, 0, w, w) }
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    function onPointer(e){
      const r = canvas.getBoundingClientRect()
      mouse.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5)))
      mouse.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5)))
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    const start = performance.now()
    function render(now){
      resize()
      const t = reduce ? 6.0 : (now - start) / 1000
      mouse.x += (mouse.tx - mouse.x) * 0.06
      mouse.y += (mouse.ty - mouse.y) * 0.06
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, t)
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    let raf = 0, running = true
    function loop(now){ if (!running) return; render(now); if (!reduce) raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => { if (reduce) render(performance.now()) })
    ro.observe(canvas)

    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running && !reduce) { running = true; raf = requestAnimationFrame(loop) }
      else if (!en.isIntersecting) { running = false; cancelAnimationFrame(raf) }
    }, { threshold: 0.01 })
    io.observe(canvas)
    function onVis(){ if (document.hidden) { running = false; cancelAnimationFrame(raf) } else if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop) } }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false; cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVis)
      ro.disconnect(); io.disconnect()
      gl.deleteProgram(prog); gl.deleteBuffer(buf)
    }
  }, [box])

  if (failed) return (
    <div className="grid place-items-center" style={{ width: `min(${box}px, 86vw)` }}>
      <HoloOrb size={size} />
    </div>
  )

  return (
    <div className="relative grid place-items-center"
      style={{ width: `min(${box}px, 86vw)`, aspectRatio: '1 / 1' }}>
      {/* faint orbital rings for depth */}
      <div className="absolute rounded-full pointer-events-none spin-slow"
        style={{ width: '82%', height: '82%', border: '1px solid rgba(255,255,255,0.06)' }} />
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: '70%', height: '70%', border: '1px solid rgba(255,255,255,0.04)' }} />

      {/* the live 3D sphere */}
      <canvas ref={canvasRef} className="floaty relative"
        style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* one holographic spark orbiting the ball */}
      <div className="absolute pointer-events-none" style={{ width: '86%', height: '86%', animation: 'spinSlow 16s linear infinite' }}>
        <span className="absolute rounded-full" style={{
          top: '2%', left: '50%', width: 9, height: 9, marginLeft: -4.5,
          background: 'radial-gradient(circle, #fff, #c9b8ff 60%, transparent)',
          boxShadow: '0 0 14px 3px rgba(200,180,255,0.9)',
        }} />
      </div>
    </div>
  )
}
