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
        this.speedX = (Math.random() - 0.5) * 0.15; // Reduced speed for minimal motion
        this.speedY = (Math.random() - 0.5) * 0.15;
        this.opacity = config.opacity !== undefined ? config.opacity : Math.random() * 0.3 + 0.15; // Lower opacity
        this.color = config.color || '#ffffff';
        this.vx = 0; // Velocity for mouse interaction
        this.vy = 0;
    }

    update(mouse) {
        // Minimal floating motion
        this.baseX += this.speedX;
        this.baseY += this.speedY;

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
            const maxDistance = 120; // Interaction radius

            if (distance < maxDistance) {
                const force = (maxDistance - distance) / maxDistance;
                const pushStrength = force * 2;

                // Push particles away
                this.vx = (dx / distance) * pushStrength;
                this.vy = (dy / distance) * pushStrength;

                // Magnify effect
                this.size = this.baseSize * (1 + force * 0.8);
            } else {
                this.size = this.baseSize;
                this.vx *= 0.9; // Damping
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
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow effect
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.fill();
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

        // Configuration - reduced particle count
        this.config = {
            ambientCount: this.isMobile || this.isTouchDevice ? 80 : 150 // Reduced from 50/150
        };

        this.colors = this.getThemeColors();

        this.init();
    }

    getThemeColors() {
        const isDark = document.body.classList.contains('dark');

        if (isDark) {
            return {
                ambient: [
                    '#ff185d',    // Primary pink - reduced opacity
                    '#ffffff6e',   // Secondary green - reduced opacity
                    '#ff185d27',  // White for subtle effect
                ]
            };
        } else {
            return {
                ambient: [
                    '#ff185d',     // Primary pink - very subtle
                    '#00000086',      // Secondary green - very subtle
                    '#ff185d50',  // Gray for subtle effect
                ]
            };
        }
    }

    updateColors() {
        this.colors = this.getThemeColors();
        // Update existing particles with new colors
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
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createAmbientParticles() {
        this.particles = [];
        for (let i = 0; i < this.config.ambientCount; i++) {
            const color = this.colors.ambient[Math.floor(Math.random() * this.colors.ambient.length)];
            this.particles.push(new Particle(this.canvas, {
                color: color,
                size: Math.random() * 1.5 + 0.8, // Smaller particles
                opacity: Math.random() * 0.25 + 0.5 // Lower opacity
            }));
        }
    }

    setupEventListeners() {
        // Mouse move
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        // Resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.createAmbientParticles();
        });

        // Theme change listener
        window.addEventListener('themeChanged', () => {
            this.updateColors();
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
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
    // DOM already loaded
    window.particleSystem = new ParticleSystem('particleCanvas');
}
