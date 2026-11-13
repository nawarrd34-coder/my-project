'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The product's signature visual: a clear glass sphere with a slowly turning
 * blue–violet core. One small fragment shader, no models or video, so it
 * costs a few KB. It pauses off-screen and when the tab is hidden.
 *
 * energy  0 = resting pulse, 1 = actively scanning
 * tint    colour the core leans towards (e.g. the result grade)
 */
interface Props {
  size?: number;
  energy?: number;
  tint?: string;
  tintAmount?: number;
  className?: string;
  label?: string;
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;
uniform vec3 uTint;
uniform float uTintMix;
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float R = 0.6;
  float r = length(uv);
  float aa = 2.0 / uRes.y;

  vec3 blue = vec3(0.184, 0.420, 1.0);
  vec3 violet = vec3(0.353, 0.298, 0.961);
  vec3 accentA = mix(blue, uTint, uTintMix);
  vec3 accentB = mix(violet, uTint * 0.75 + 0.05, uTintMix * 0.85);
  float t = uTime * (0.16 + 0.42 * uEnergy);
  float pulse = 0.86 + 0.14 * sin(uTime * (1.3 + 2.2 * uEnergy));

  vec3 col = vec3(0.0);
  float a = smoothstep(R, R - aa, r);

  if (r < R + aa) {
    vec2 p = uv / R;
    float rad = min(length(p), 1.0);
    float z = sqrt(max(1.0 - rad * rad, 0.0));
    vec3 n = normalize(vec3(p, z));

    // Swirl: the angle turns more towards the centre, like liquid light inside glass.
    float ang = atan(p.y, p.x) + t * 1.15 + (1.0 - rad) * (2.2 + 2.0 * uEnergy);
    vec2 q = vec2(cos(ang), sin(ang)) * rad;
    float f = fbm(q * 2.3 + vec2(t * 0.6, -t * 0.4));
    float f2 = fbm(q * 3.6 - vec2(t * 0.3, t * 0.5) + f * 1.6);

    float core = smoothstep(1.0, 0.0, rad);
    float swirl = smoothstep(0.38, 0.86, f2) * core;
    vec3 inner = mix(accentB * 0.55, accentA * 1.15, f) * (0.38 + 1.5 * swirl * pulse);
    // a second, finer filament layer so the core reads as moving light, not smoke
    float fil = smoothstep(0.55, 0.95, fbm(q * 6.0 + vec2(-t * 0.8, t * 0.6) + f2 * 2.0));
    inner += mix(accentA, vec3(0.8, 0.86, 1.0), 0.35) * fil * core * 0.55 * pulse;
    inner += mix(accentA, vec3(0.88, 0.92, 1.0), 0.3) * pow(core, 2.4) * 0.95 * pulse * (0.65 + 0.55 * uEnergy);

    vec3 glass = mix(vec3(0.03, 0.04, 0.11), accentB * 0.18, 0.5);
    col = mix(glass, inner, smoothstep(1.04, 0.05, rad));

    float fres = pow(1.0 - z, 2.6);
    col += mix(vec3(0.62, 0.7, 1.0), accentA, 0.45) * fres * 0.75;

    vec3 L = normalize(vec3(-0.5, 0.62, 0.7));
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 46.0);
    col += vec3(1.0) * spec * 0.9;
    float spec2 = pow(max(dot(n, normalize(vec3(0.55, -0.5, 0.65))), 0.0), 16.0);
    col += accentA * spec2 * 0.22;
    // thin bright edge where the glass curves away
    col += vec3(0.75, 0.82, 1.0) * smoothstep(0.9, 1.0, rad) * smoothstep(1.0, 0.97, rad) * 0.35;
  }

  // Soft halo outside the sphere (premultiplied colour).
  float d = max(r - R, 0.0);
  // Fade to nothing well before the canvas edge so no square ever shows.
  float halo = exp(-d * (6.0 - 2.0 * uEnergy)) * (0.32 + 0.45 * uEnergy) * pulse * smoothstep(0.98, 0.66, r);
  vec3 haloCol = mix(accentA, accentB, 0.45) * halo;

  vec3 premul = col * a + haloCol * (1.0 - a);
  float alpha = clamp(a + halo * (1.0 - a), 0.0, 1.0);
  outColor = vec4(premul, alpha);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

/** CSS-only orb for small, decorative uses (no WebGL context). */
export function StaticOrb({ size = 64, tint = '#2f6bff', tintAmount = 0, className = '' }: { size?: number; tint?: string; tintAmount?: number; className?: string }) {
  const [r, g, b] = hexToRgb(tint).map((c) => Math.round(c * 255));
  const core = tintAmount > 0 ? `rgba(${r},${g},${b},.9)` : 'rgba(79,134,255,.9)';
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <div
        className="absolute inset-[14%] rounded-full"
        style={{
          background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.75), transparent 16%), radial-gradient(circle at 50% 56%, ${core}, rgba(90,76,245,.55) 46%, rgba(10,12,30,.96) 74%)`,
          boxShadow: `0 0 ${Math.round(size * 0.35)}px rgba(${tintAmount > 0 ? `${r},${g},${b}` : '79,134,255'},.4), inset 0 0 ${Math.round(size * 0.12)}px rgba(180,195,255,.55)`,
        }}
      />
    </div>
  );
}

export function GlassOrb({ size = 280, energy = 0.15, tint = '#2f6bff', tintAmount = 0, className = '', label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef({ energy, tint: hexToRgb(tint), tintAmount });
  const wakeRef = useRef<(() => void) | null>(null);
  const [fallback, setFallback] = useState(false);

  target.current = { energy, tint: hexToRgb(tint), tintAmount };

  useEffect(() => {
    wakeRef.current?.();
  }, [energy, tint, tintAmount]);

  // Create the WebGL context only once the orb is near the viewport.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || near) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(canvas);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !near) return;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      setFallback(true);
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      setFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      energy: gl.getUniformLocation(program, 'uEnergy'),
      tint: gl.getUniformLocation(program, 'uTint'),
      tintMix: gl.getUniformLocation(program, 'uTintMix'),
    };

    // Without a real GPU (software rasterisers, many headless test browsers) a full-rate
    // shader would load the CPU; those get a single still frame instead.
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    const reduce = software || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { energy: target.current.energy, tint: [...target.current.tint], tintMix: target.current.tintAmount, time: 4 };
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let alive = true;
    let started = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      // Cap the pixel count: the orb never needs more than ~720px of resolution.
      const px = Math.min(Math.round(rect.width * dpr), 720);
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = () => {
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, state.time);
      gl.uniform1f(u.energy, state.energy);
      gl.uniform3f(u.tint, state.tint[0], state.tint[1], state.tint[2]);
      gl.uniform1f(u.tintMix, state.tintMix);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.exp(-dt * 2.6);
      const tgt = target.current;
      state.energy += (tgt.energy - state.energy) * k;
      state.tintMix += (tgt.tintAmount - state.tintMix) * k;
      for (let i = 0; i < 3; i++) state.tint[i] += (tgt.tint[i] - state.tint[i]) * k;
      if (reduce) {
        draw();
        const settling = Math.abs(tgt.energy - state.energy) > 0.002 || Math.abs(tgt.tintAmount - state.tintMix) > 0.002;
        if (settling && visible) raf = requestAnimationFrame(frame);
        return;
      }
      state.time += dt;
      draw();
      if (visible && document.visibilityState !== 'hidden') raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf || !alive) return;
      if (!started) {
        // Before the loop starts, keep the canvas current without animating.
        resize();
        draw();
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;

    const ro = new ResizeObserver(() => {
      resize();
      wake();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) wake();
    });
    io.observe(canvas);
    const onVis = () => wake();
    document.addEventListener('visibilitychange', onVis);
    resize();
    // Paint one frame now; start the animation loop once the page has settled.
    draw();
    let idleId = 0;
    const startLoop = () => {
      started = true;
      wake();
    };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (document.readyState === 'complete') idleId = ric ? ric(startLoop, { timeout: 1500 }) : window.setTimeout(startLoop, 300);
    else window.addEventListener('load', () => (idleId = ric ? ric(startLoop, { timeout: 1500 }) : window.setTimeout(startLoop, 300)), { once: true });

    return () => {
      alive = false;
      void idleId;
      wakeRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [near]);

  const [r, g, b] = hexToRgb(tint).map((c) => Math.round(c * 255));
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {fallback ? (
        <div
          className="absolute inset-[20%] rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), transparent 22%), radial-gradient(circle at 50% 55%, rgba(${r},${g},${b},${0.55 + tintAmount * 0.3}), rgba(90,76,245,.55) 45%, rgba(8,8,16,.95) 72%)`,
            boxShadow: `0 0 80px rgba(${r},${g},${b},.35), inset 0 0 30px rgba(170,190,255,.35)`,
          }}
        />
      ) : (
        <>
          {!near && <StaticOrb size={size} tint={tint} tintAmount={tintAmount} className="absolute inset-0 scale-[0.86]" />}
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        </>
      )}
    </div>
  );
}
