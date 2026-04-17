import { useRef, useEffect } from 'react';

export default function CyberBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // 网格参数
    const gridSize = 60;
    const gridColor = 'rgba(0, 212, 255, 0.05)';

    // 数据流粒子
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 0.3 + Math.random() * 0.8,
      horizontal: Math.random() > 0.5, // 沿水平或垂直网格线移动
      dir: Math.random() > 0.5 ? 1 : -1,
      size: 1 + Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    }));

    // 偶尔出现的脉冲线
    const pulses = [];
    let nextPulse = Date.now() + (2000 + Math.random() * 4000);

    const spawnPulse = () => ({
      horizontal: Math.random() > 0.5,
      pos: Math.round((Math.random() * (canvas.horizontal ? canvas.height : canvas.width)) / gridSize) * gridSize,
      progress: 0,
      speed: 3 + Math.random() * 4,
      opacity: 0.15 + Math.random() * 0.1,
    });

    const animate = (time) => {
      const t = time / 1000;
      // 深蓝黑底
      ctx.fillStyle = '#0a0c14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制网格
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // 绘制数据流粒子
      for (const p of particles) {
        if (p.horizontal) {
          p.x += p.speed * p.dir;
          // 吸附到最近的网格线
          p.y = Math.round(p.y / gridSize) * gridSize;
          if (p.x > canvas.width + 10) p.x = -10;
          if (p.x < -10) p.x = canvas.width + 10;
        } else {
          p.y += p.speed * p.dir;
          p.x = Math.round(p.x / gridSize) * gridSize;
          if (p.y > canvas.height + 10) p.y = -10;
          if (p.y < -10) p.y = canvas.height + 10;
        }

        const flicker = 0.7 + 0.3 * Math.sin(t * 2 + p.phase);
        const alpha = p.opacity * flicker;

        // 光晕
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        glow.addColorStop(0, `rgba(0, 212, 255, ${alpha * 0.6})`);
        glow.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * p.size * 8);

        // 核心点
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
        ctx.fill();
      }

      // 脉冲线
      if (Date.now() >= nextPulse) {
        pulses.push(spawnPulse());
        nextPulse = Date.now() + (3000 + Math.random() * 5000);
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const pl = pulses[i];
        pl.progress += pl.speed;
        const maxLen = pl.horizontal ? canvas.width : canvas.height;

        if (pl.progress > maxLen + 200) {
          pulses.splice(i, 1);
          continue;
        }

        const grad = pl.horizontal
          ? ctx.createLinearGradient(pl.progress - 200, 0, pl.progress, 0)
          : ctx.createLinearGradient(0, pl.progress - 200, 0, pl.progress);
        grad.addColorStop(0, 'rgba(0, 212, 255, 0)');
        grad.addColorStop(1, `rgba(0, 212, 255, ${pl.opacity})`);

        ctx.beginPath();
        if (pl.horizontal) {
          ctx.moveTo(Math.max(0, pl.progress - 200), pl.pos);
          ctx.lineTo(pl.progress, pl.pos);
        } else {
          ctx.moveTo(pl.pos, Math.max(0, pl.progress - 200));
          ctx.lineTo(pl.pos, pl.progress);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}
    />
  );
}
