// Reactive Particle Animation System
// Canvas-based floating particles with hover magnify effects
// Theme-aware color adaptation

class Particle {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.baseX = config.x !== undefined ? config.x : Math.random() * canvas.logicalWidth;
        this.baseY = config.y !== undefined ? config.y : Math.random() * canvas.logicalHeight;
        this.x = this.baseX;
        this.y = this.baseY;
        this.size = config.size || (Math.random() * 2 + 1);
        this.baseSize = this.size;
        this.speedX = (Math.random() - 0.5) * 0.15;
        this.speedY = (Math.random() - 0.5) * 0.15;
        this.opacity = config.opacity !== undefined ? config.opacity : Math.random() * 0.3 + 0.15;
        this.color = config.color || '#ffffff';
        this.vx = 0;
        this.vy = 0;

        // Slow rotation
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.005;
    }

    drawTriangle(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x - size, y + size);
        ctx.closePath();
        ctx.fill();
    }

    update(mouse, width, height) {
        // Minimal floating motion
        this.baseX += this.speedX;
        this.baseY += this.speedY;

        // Slow rotation
        this.rotation += this.rotationSpeed;

        // Wrap around edges
        if (this.baseX < 0) this.baseX = width;
        if (this.baseX > width) this.baseX = 0;
        if (this.baseY < 0) this.baseY = height;
        if (this.baseY > height) this.baseY = 0;

        // Mouse interaction - magnify/push effect
        if (mouse.x !== null && mouse.y !== null) {
            const dx = this.baseX - mouse.x;
            const dy = this.baseY - mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 120;

            if (distance < maxDistance && distance > 0) {
                const force = (maxDistance - distance) / maxDistance;
                const pushStrength = force * 2;

                this.vx = (dx / distance) * pushStrength;
                this.vy = (dy / distance) * pushStrength;

                // Magnify effect
                this.size = this.baseSize * (1 + force * 0.8);
            } else {
                this.size = this.baseSize;
                this.vx *= 0.9;
                this.vy *= 0.9;
            }
        } else {
            this.size = this.baseSize;
            this.vx *= 0.9;
            this.vy *= 0.9;
        }

        // Apply velocity
        this.x = this.baseX + this.vx * 10;
        this.y = this.baseY + this.vy * 10;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;

        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Subtle glow
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.color;

        this.drawTriangle(ctx, 0, 0, this.size);

        ctx.restore();
    }
}

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null };
        this.animationId = null;
        this.resizeTimer = null;

        // Logical (CSS pixel) size, kept separate from the DPR-scaled backing store.
        this.width = 0;
        this.height = 0;

        // Device detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.prefersReducedMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Configuration
        this.config = {
            ambientCount: this.isMobile || this.isTouchDevice ? 80 : 150
        };

        // Bound handlers so they can actually be removed again.
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleThemeChange = this.handleThemeChange.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

        this.colors = this.getThemeColors();
        this.init();
    }

    getThemeColors() {
        const isDark = document.body.classList.contains('dark');

        if (isDark) {
            return {
                ambient: [
                    '#ff185d',
                    '#ffffff6e',
                    '#ff185d27',
                ]
            };
        } else {
            return {
                ambient: [
                    '#ff185d',
                    '#00000086',
                    '#ff185d50',
                ]
            };
        }
    }

    updateColors() {
        this.colors = this.getThemeColors();
        this.particles.forEach(p => {
            p.color = this.colors.ambient[Math.floor(Math.random() * this.colors.ambient.length)];
        });
    }

    init() {
        this.resizeCanvas();
        this.createAmbientParticles();
        this.setupEventListeners();

        // Reduced motion: render one static frame instead of animating.
        if (this.prefersReducedMotion) {
            this.renderFrame();
        } else {
            this.animate();
        }
    }

    resizeCanvas() {
        // Scale the backing store by devicePixelRatio so particles stay crisp on HiDPI screens,
        // while all drawing stays in CSS pixels.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.logicalWidth = this.width;
        this.canvas.logicalHeight = this.height;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    createAmbientParticles() {
        this.particles = [];
        for (let i = 0; i < this.config.ambientCount; i++) {
            const color = this.colors.ambient[Math.floor(Math.random() * this.colors.ambient.length)];
            this.particles.push(new Particle(this.canvas, {
                color: color,
                size: Math.random() * 1.5 + 1.8,
                opacity: Math.random() * 0.2 + 0.5
            }));
        }
    }

    handleMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
    }

    handleResize() {
        // Debounced: dragging a window edge would otherwise rebuild 150 particles per event.
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.resizeCanvas();
            this.createAmbientParticles();
            if (this.prefersReducedMotion) this.renderFrame();
        }, 150);
    }

    handleThemeChange() {
        this.updateColors();
        if (this.prefersReducedMotion) this.renderFrame();
    }

    handleVisibilityChange() {
        if (this.prefersReducedMotion) return;

        if (document.hidden) {
            this.stop();
        } else if (!this.animationId) {
            this.animate();
        }
    }

    setupEventListeners() {
        window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('themeChanged', this.handleThemeChange);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    renderFrame() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].update(this.mouse, this.width, this.height);
            this.particles[i].draw(this.ctx);
        }
    }

    animate() {
        this.renderFrame();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    destroy() {
        this.stop();
        clearTimeout(this.resizeTimer);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('themeChanged', this.handleThemeChange);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}

// Initialize particle system when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.particleSystem = new ParticleSystem('particleCanvas');
    });
} else {
    window.particleSystem = new ParticleSystem('particleCanvas');
}
