import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseOpacity: number;
}

const LINK_DISTANCE = 140;
const MOUSE_RADIUS = 110;
const MOUSE_STRENGTH = 0.0009;
const DAMPING = 0.997;
const MAX_SPEED = 0.075; // px/ms

// Darkens the theme's brand green (via a straight RGB scale-down) so the
// constellation reads as a deep, muted tone rather than the same bright
// green used for badges/icons — decoration should sit quietly behind the
// sign-in card, not compete with it.
const DARKEN_FACTOR = 0.55;

function darkenedRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  const r = Math.round(((value >> 16) & 255) * DARKEN_FACTOR);
  const g = Math.round(((value >> 8) & 255) * DARKEN_FACTOR);
  const b = Math.round((value & 255) * DARKEN_FACTOR);
  return `${r}, ${g}, ${b}`;
}

function buildParticles(width: number, height: number): Particle[] {
  const count = Math.min(70, Math.max(18, Math.round((width * height) / 18000)));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.09,
    vy: (Math.random() - 0.5) * 0.09,
    r: 1 + Math.random() * 1.5,
    baseOpacity: 0.25 + Math.random() * 0.4,
  }));
}

/**
 * A hand-rolled take on shadcn.io's "constellation" background
 * (shadcn.io/background/constellation): floating nodes drift slowly, lines
 * connect nodes that stray close together and fade with distance, and
 * nearby nodes gently drift away from the cursor. shadcn.io only ships this
 * as copy-paste source via their own site (behind an MCP tool this
 * environment doesn't have configured, no public package/repo) — so this
 * reimplements the described effect natively with Canvas 2D, no dependency.
 * `dark` swaps the dot/line tint for the panel behind it; canvas colors are
 * plain JS values, not CSS, so this can't just hook into `dark:` utilities.
 */
export function ParticlesBackground({ dark, className }: { dark: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Pull the brand green straight from the theme token (--series-1) so the
    // constellation always matches whatever the app's green actually is,
    // rather than a hand-picked hex that can drift out of sync with it —
    // then darken it (see DARKEN_FACTOR) so it stays quiet in the background.
    const seriesGreen = getComputedStyle(document.documentElement).getPropertyValue("--series-1").trim() || (dark ? "#299e5e" : "#1b7343");
    const rgb = darkenedRgb(seriesGreen);
    const dotColor = `rgb(${rgb})`;
    const linkRgb = rgb;
    const linkMaxAlpha = dark ? 0.5 : 0.4;

    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let mouse: { x: number; y: number } | null = null;
    let rafId = 0;
    let lastTime = 0;
    let inViewport = true;
    let tabVisible = document.visibilityState === "visible";

    function resize() {
      const rect = host!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = buildParticles(width, height);
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            ctx!.strokeStyle = `rgba(${linkRgb}, ${((1 - dist / LINK_DISTANCE) * linkMaxAlpha).toFixed(3)})`;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      ctx!.fillStyle = dotColor;
      ctx!.shadowColor = dotColor;
      ctx!.shadowBlur = 5;
      for (const p of particles) {
        ctx!.globalAlpha = p.baseOpacity;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.shadowBlur = 0;
    }

    function tick(time: number) {
      rafId = requestAnimationFrame(tick);
      if (!inViewport || !tabVisible) return;
      const dt = lastTime ? Math.min(48, time - lastTime) : 16;
      lastTime = time;

      for (const p of particles) {
        if (mouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_RADIUS && dist > 0.01) {
            const push = (MOUSE_RADIUS - dist) * MOUSE_STRENGTH;
            p.vx += (dx / dist) * push;
            p.vy += (dy / dist) * push;
          }
        }
        p.vx = (p.vx + (Math.random() - 0.5) * 0.004) * DAMPING;
        p.vy = (p.vy + (Math.random() - 0.5) * 0.004) * DAMPING;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0 || p.x > width) {
          p.vx *= -1;
          p.x = Math.min(width, Math.max(0, p.x));
        }
        if (p.y < 0 || p.y > height) {
          p.vy *= -1;
          p.y = Math.min(height, Math.max(0, p.y));
        }
      }

      draw();
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onMouseLeave() {
      mouse = null;
    }
    function onVisibilityChange() {
      tabVisible = document.visibilityState === "visible";
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw();
    });
    resizeObserver.observe(host);
    resize();

    if (reduceMotion) {
      draw();
      return () => resizeObserver.disconnect();
    }

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
    });
    intersectionObserver.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [dark]);

  return (
    <div aria-hidden="true" className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
