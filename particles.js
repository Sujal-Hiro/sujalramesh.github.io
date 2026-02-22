// Reactive Particle Animation System
// Canvas-based floating particles with hover magnify effects
// Theme-aware color adaptation

class Particle {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.baseX = config.x !== undefined ? config.x : Math.random() * canvas.width;
        this.baseY = config.y !== undefined ? config.y : Math.random() * canvas.height;
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

        // Random shape type
        const shapes = ['triangle'];
        this.shape = shapes[Math.floor(Math.random() * shapes.length)];

        // Slow rotation for non-circle shapes
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.005;
    }

    drawCircle(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    drawDiamond(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fill();
    }

    drawCross(ctx, x, y, size) {
        const arm = size * 0.35;
        const len = size;
        ctx.beginPath();
        ctx.moveTo(x - arm, y - len);
        ctx.lineTo(x + arm, y - len);
        ctx.lineTo(x + arm, y - arm);
        ctx.lineTo(x + len, y - arm);
        ctx.lineTo(x + len, y + arm);
        ctx.lineTo(x + arm, y + arm);
        ctx.lineTo(x + arm, y + len);
        ctx.lineTo(x - arm, y + len);
        ctx.lineTo(x - arm, y + arm);
        ctx.lineTo(x - len, y + arm);
        ctx.lineTo(x - len, y - arm);
        ctx.lineTo(x - arm, y - arm);
        ctx.closePath();
        ctx.fill();
    }

    drawTriangle(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x - size, y + size);
        ctx.closePath();
        ctx.fill();
    }

    drawStar(ctx, x, y, size) {
        const spikes = 4;
        const outerRadius = size;
        const innerRadius = size * 0.45;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(x, y - outerRadius);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(
                x + Math.cos(rot) * outerRadius,
                y + Math.sin(rot) * outerRadius
            );
            rot += step;
            ctx.lineTo(
                x + Math.cos(rot) * innerRadius,
                y + Math.sin(rot) * innerRadius
            );
            rot += step;
        }
        ctx.lineTo(x, y - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    update(mouse) {
        // Minimal floating motion
        this.baseX += this.speedX;
        this.baseY += this.speedY;

        // Slow rotation
        this.rotation += this.rotationSpeed;

        // Wrap around edges
        if (this.baseX < 0) this.baseX = this.canvas.width;
        if (this.baseX > this.canvas.width) this.baseX = 0;
        if (this.baseY < 0) this.baseY = this.canvas.height;
        if (this.baseY > this.canvas.height) this.baseY = 0;

        // Mouse interaction - magnify/push effect
        if (mouse.x !== null && mouse.y !== null) {
            const dx = this.baseX - mouse.x;
            const dy = this.baseY - mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 120;

            if (distance < maxDistance) {
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

        // Apply rotation transform for non-circle shapes
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Subtle glow
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.color;

        switch (this.shape) {
            case 'circle':
                this.drawCircle(ctx, 0, 0, this.size);
                break;
            case 'diamond':
                this.drawDiamond(ctx, 0, 0, this.size);
                break;
            case 'cross':
                this.drawCross(ctx, 0, 0, this.size * 0.9);
                break;
            case 'triangle':
                this.drawTriangle(ctx, 0, 0, this.size);
                break;
            case 'star':
                this.drawStar(ctx, 0, 0, this.size * 1.2);
                break;
        }

        ctx.restore();
    }
}

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas element with id "${canvasId}" not found`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null };
        this.animationId = null;

        // Device detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Configuration
        this.config = {
            ambientCount: this.isMobile || this.isTouchDevice ? 80 : 150
        };

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
        this.animate();
    }

    resizeCanvas() {
        // Use window dimensions for fixed canvas
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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

    setupEventListeners() {
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.createAmbientParticles();
        });

        window.addEventListener('themeChanged', () => {
            this.updateColors();
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].update(this.mouse);
            this.particles[i].draw(this.ctx);
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('themeChanged', this.handleThemeChange);
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
