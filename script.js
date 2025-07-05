

// Nightmare Survival - Ultra Hard Horror Game
// Advanced Web Game Engine with Procedural Generation, AI, and Horror Elements

class GameEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isLoaded = false;
        this.currentScreen = 'loading';
        this.gameState = 'menu';
        this.settings = {
            volume: 70,
            graphicsQuality: 'medium',
            motionEffects: true,
            hapticFeedback: true,
            theme: 'dark'
        };
        
        // Game variables
        this.player = null;
        this.enemies = [];
        this.obstacles = [];
        this.powerUps = [];
        this.level = 1;
        this.score = 0;
        this.health = 100;
        this.sanity = 100;
        this.gameTime = 0;
        this.isSpeedrun = false;
        this.lastTime = 0;
        
        // Advanced features
        this.proceduralGenerator = new ProceduralGenerator();
        this.audioEngine = new AudioEngine();
        this.aiSystem = new AISystem();
        this.physicsEngine = new PhysicsEngine();
        this.particleSystem = new ParticleSystem();
        this.highScoreManager = new HighScoreManager();
        
        this.init();
    }
    
    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadSettings();
        await this.loadAssets();
        this.startGameLoop();
        this.showScreen('main-menu');
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupEventListeners() {
        // Menu navigation
        document.getElementById('start-game').addEventListener('click', () => this.startGame(false));
        document.getElementById('speedrun-mode').addEventListener('click', () => this.startGame(true));
        document.getElementById('leaderboard').addEventListener('click', () => this.showLeaderboard());
        document.getElementById('settings').addEventListener('click', () => this.showSettings());
        document.getElementById('theme-btn').addEventListener('click', () => this.toggleTheme());
        
        // Game controls
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.handleGameInput(e);
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        
        // Touch controls for mobile
        this.setupTouchControls();
        
        // Back buttons
        document.getElementById('back-to-menu').addEventListener('click', () => this.showScreen('main-menu'));
        document.getElementById('settings-back').addEventListener('click', () => this.showScreen('main-menu'));
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('main-menu-btn').addEventListener('click', () => this.showScreen('main-menu'));
        
        // Settings
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            this.settings.volume = e.target.value;
            this.audioEngine.setVolume(e.target.value / 100);
            this.saveSettings();
        });
        
        document.getElementById('graphics-quality').addEventListener('change', (e) => {
            this.settings.graphicsQuality = e.target.value;
            this.updateGraphicsQuality();
            this.saveSettings();
        });
        
        document.getElementById('motion-effects').addEventListener('change', (e) => {
            this.settings.motionEffects = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('haptic-feedback').addEventListener('change', (e) => {
            this.settings.hapticFeedback = e.target.checked;
            this.saveSettings();
        });
    }
    
    setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            
            if (this.settings.hapticFeedback && navigator.vibrate) {
                navigator.vibrate(50);
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            
            this.handleTouchMovement(deltaX, deltaY);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
        });
    }
    
    handleTouchMovement(deltaX, deltaY) {
        if (!this.player) return;
        
        const sensitivity = 0.1;
        this.player.velocity.x += deltaX * sensitivity;
        this.player.velocity.y += deltaY * sensitivity;
    }
    
    async loadAssets() {
        const loadingBar = document.querySelector('.loading-bar');
        const assets = [
            'textures', 'sounds', 'models', 'shaders', 'data'
        ];
        
        for (let i = 0; i < assets.length; i++) {
            await this.simulateAssetLoad(assets[i]);
            loadingBar.style.width = `${((i + 1) / assets.length) * 100}%`;
        }
        
        this.isLoaded = true;
        setTimeout(() => {
            document.getElementById('loading-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
            }, 500);
        }, 1000);
    }
    
    simulateAssetLoad(asset) {
        return new Promise(resolve => {
            setTimeout(resolve, 200 + Math.random() * 300);
        });
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }
    
    startGame(speedrunMode = false) {
        this.isSpeedrun = speedrunMode;
        this.resetGame();
        this.showScreen('game-screen');
        this.gameState = 'playing';
        this.audioEngine.playAmbient('nightmare');
        this.generateLevel();
    }
    
    resetGame() {
        this.level = 1;
        this.score = 0;
        this.health = 100;
        this.sanity = 100;
        this.gameTime = 0;
        this.enemies = [];
        this.obstacles = [];
        this.powerUps = [];
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
        this.updateUI();
    }
    
    generateLevel() {
        const levelData = this.proceduralGenerator.generateLevel(this.level);
        this.enemies = levelData.enemies;
        this.obstacles = levelData.obstacles;
        this.powerUps = levelData.powerUps;
        
        // AI-assisted difficulty scaling
        this.aiSystem.adjustDifficulty(this.player.skillLevel, this.level);
    }
    
    startGameLoop() {
        const gameLoop = (timestamp) => {
            this.update(timestamp);
            this.render();
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    }
    
    update(timestamp) {
        if (this.gameState !== 'playing') return;
        
        const deltaTime = timestamp - (this.lastTime || timestamp);
        this.lastTime = timestamp;
        this.gameTime += deltaTime;
        
        // Update player
        if (this.player) {
            this.player.update(deltaTime, this.keys);
            this.checkPlayerCollisions();
        }
        
        // Update enemies with AI
        this.enemies.forEach(enemy => {
            enemy.update(deltaTime, this.player, this.aiSystem);
        });
        
        // Update physics
        this.physicsEngine.update(deltaTime);
        
        // Update particles
        this.particleSystem.update(deltaTime);
        
        // Update sanity system
        this.updateSanitySystem(deltaTime);
        
        // Check win/lose conditions
        this.checkGameConditions();
        
        // Update UI
        this.updateUI();
    }
    
    render() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.gameState === 'playing') {
            this.ctx.save();
            
            // Render environment effects based on sanity
            this.renderSanityEffects();
            
            // Render game objects
            this.renderPlayer();
            this.renderEnemies();
            this.renderObstacles();
            this.renderPowerUps();
            
            // Render particles
            this.particleSystem.render(this.ctx);
            
            // Render lighting and shadows
            this.renderLighting();
            
            this.ctx.restore();
        }
    }
    
    renderSanityEffects() {
        const sanityLevel = this.sanity / 100;
        
        if (sanityLevel < 0.5) {
            // Visual distortion
            this.ctx.filter = `blur(${(1 - sanityLevel) * 2}px) hue-rotate(${(1 - sanityLevel) * 180}deg)`;
        }
    }
    
    renderPlayer() {
        if (!this.player) return;
        
        this.ctx.save();
        this.ctx.translate(this.player.x, this.player.y);
        this.ctx.rotate(this.player.rotation);
        
        // Advanced CSS-like rendering
        this.ctx.fillStyle = this.player.damaged ? '#ff4444' : '#44ff44';
        this.ctx.fillRect(-15, -15, 30, 30);
        
        // Damage effects
        if (this.player.damaged) {
            this.particleSystem.createBloodSplatter(this.player.x, this.player.y);
        }
        
        this.ctx.restore();
    }
    
    renderEnemies() {
        this.enemies.forEach(enemy => {
            this.ctx.save();
            this.ctx.translate(enemy.x, enemy.y);
            this.ctx.rotate(enemy.rotation);
            
            // Demonic entity rendering
            this.ctx.fillStyle = enemy.type === 'demon' ? '#8b0000' : '#ff0000';
            this.ctx.fillRect(-20, -20, 40, 40);
            
            // Glowing eyes effect
            this.ctx.fillStyle = '#ff0000';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ff0000';
            this.ctx.fillRect(-8, -8, 4, 4);
            this.ctx.fillRect(4, -8, 4, 4);
            
            this.ctx.restore();
        });
    }
    
    renderObstacles() {
        if (!this.obstacles) return;
        
        this.obstacles.forEach(obstacle => {
            this.ctx.save();
            this.ctx.fillStyle = '#666666';
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            this.ctx.restore();
        });
    }
    
    renderPowerUps() {
        if (!this.powerUps) return;
        
        this.powerUps.forEach(powerUp => {
            this.ctx.save();
            this.ctx.translate(powerUp.x, powerUp.y);
            this.ctx.rotate(this.gameTime * 0.001);
            
            this.ctx.fillStyle = powerUp.type === 'health' ? '#44ff44' : '#ffaa00';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = powerUp.type === 'health' ? '#44ff44' : '#ffaa00';
            this.ctx.fillRect(-10, -10, 20, 20);
            
            this.ctx.restore();
        });
    }
    
    renderLighting() {
        if (!this.player) return;
        
        // Dynamic lighting system
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'multiply';
        
        const gradient = this.ctx.createRadialGradient(
            this.player.x, this.player.y, 0,
            this.player.x, this.player.y, 200
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }
    
    updateSanitySystem(deltaTime) {
        // Decrease sanity over time
        this.sanity -= deltaTime * 0.005;
        
        // Sanity effects
        if (this.sanity < 50) {
            // Trigger audio distortion
            this.audioEngine.applySanityEffects(this.sanity / 100);
        }
        
        if (this.sanity < 20) {
            // Hallucinations - spawn fake enemies
            if (Math.random() < 0.0001) {
                this.spawnHallucination();
            }
        }
        
        this.sanity = Math.max(0, this.sanity);
    }
    
    spawnHallucination() {
        const hallucination = new Enemy(
            Math.random() * this.canvas.width,
            Math.random() * this.canvas.height,
            'hallucination'
        );
        hallucination.isHallucination = true;
        this.enemies.push(hallucination);
        
        // Remove after short time
        setTimeout(() => {
            const index = this.enemies.indexOf(hallucination);
            if (index > -1) {
                this.enemies.splice(index, 1);
            }
        }, 2000);
    }
    
    checkPlayerCollisions() {
        // Enemy collisions
        this.enemies.forEach((enemy, index) => {
            if (this.checkCollision(this.player, enemy)) {
                if (!enemy.isHallucination) {
                    this.takeDamage(20);
                    this.audioEngine.playSound('damage');
                    this.player.damaged = true;
                    setTimeout(() => this.player.damaged = false, 500);
                }
                this.enemies.splice(index, 1);
            }
        });
        
        // Power-up collisions
        if (this.powerUps) {
            this.powerUps.forEach((powerUp, index) => {
                if (this.checkCollision(this.player, powerUp)) {
                    this.collectPowerUp(powerUp);
                    this.powerUps.splice(index, 1);
                }
            });
        }
    }
    
    checkCollision(obj1, obj2) {
        const distance = Math.sqrt(
            Math.pow(obj1.x - obj2.x, 2) + Math.pow(obj1.y - obj2.y, 2)
        );
        return distance < (obj1.radius || 15) + (obj2.radius || 15);
    }
    
    takeDamage(amount) {
        this.health -= amount;
        this.sanity -= amount * 0.5;
        
        if (this.health <= 0) {
            this.gameOver();
        }
        
        // Screen shake
        if (this.settings.motionEffects) {
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 500);
        }
        
        // Haptic feedback
        if (this.settings.hapticFeedback && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    }
    
    collectPowerUp(powerUp) {
        switch (powerUp.type) {
            case 'health':
                this.health = Math.min(100, this.health + 25);
                break;
            case 'sanity':
                this.sanity = Math.min(100, this.sanity + 30);
                break;
            case 'score':
                this.score += 100;
                break;
        }
        
        this.audioEngine.playSound('powerup');
        this.particleSystem.createPowerUpEffect(powerUp.x, powerUp.y);
    }
    
    checkGameConditions() {
        // Level completion
        if (this.enemies.filter(e => !e.isHallucination).length === 0 && this.level < 500) {
            this.nextLevel();
        }
        
        // Game over conditions
        if (this.health <= 0 || this.sanity <= 0) {
            this.gameOver();
        }
    }
    
    nextLevel() {
        this.level++;
        this.score += 1000 * this.level;
        this.audioEngine.playSound('levelComplete');
        
        // Restore some health and sanity
        this.health = Math.min(100, this.health + 10);
        this.sanity = Math.min(100, this.sanity + 5);
        
        this.generateLevel();
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.audioEngine.stopAmbient();
        this.audioEngine.playSound('gameOver');
        
        // Save high score
        this.highScoreManager.saveScore({
            score: this.score,
            level: this.level,
            time: this.gameTime,
            mode: this.isSpeedrun ? 'speedrun' : 'survival'
        });
        
        document.getElementById('death-overlay').classList.remove('hidden');
    }
    
    restartGame() {
        document.getElementById('death-overlay').classList.add('hidden');
        this.startGame(this.isSpeedrun);
    }
    
    updateUI() {
        // Health bar
        const healthFill = document.querySelector('.health-fill');
        const healthText = document.querySelector('.health-text');
        if (healthFill && healthText) {
            healthFill.style.width = `${this.health}%`;
            healthText.textContent = Math.floor(this.health);
        }
        
        // Sanity bar
        const sanityFill = document.querySelector('.sanity-fill');
        const sanityText = document.querySelector('.sanity-text');
        if (sanityFill && sanityText) {
            sanityFill.style.width = `${this.sanity}%`;
            
            if (this.sanity > 70) sanityText.textContent = 'SANE';
            else if (this.sanity > 40) sanityText.textContent = 'UNEASY';
            else if (this.sanity > 20) sanityText.textContent = 'DISTURBED';
            else sanityText.textContent = 'INSANE';
        }
        
        // Level and timer
        const levelElement = document.getElementById('level-number');
        const timerElement = document.getElementById('timer');
        if (levelElement) levelElement.textContent = `LEVEL ${this.level}`;
        if (timerElement) timerElement.textContent = this.formatTime(this.gameTime);
    }
    
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    
    handleGameInput(e) {
        switch (e.code) {
            case 'Escape':
                if (this.gameState === 'playing') {
                    this.showScreen('main-menu');
                    this.gameState = 'paused';
                }
                break;
            case 'KeyE':
                this.handleInteraction();
                break;
        }
    }
    
    handleInteraction() {
        // Check for nearby interactive objects
        // Implementation for environmental interactions
    }
    
    showLeaderboard() {
        this.showScreen('leaderboard-screen');
        this.loadLeaderboard();
    }
    
    loadLeaderboard() {
        const entries = this.highScoreManager.getLeaderboard();
        const container = document.getElementById('leaderboard-entries');
        if (container) {
            container.innerHTML = '';
            
            entries.forEach((entry, index) => {
                const entryDiv = document.createElement('div');
                entryDiv.className = 'leaderboard-entry';
                entryDiv.innerHTML = `
                    <span>${index + 1}</span>
                    <span>Player ${entry.id || 'Anonymous'}</span>
                    <span>${entry.score}</span>
                    <span>${entry.level}</span>
                `;
                container.appendChild(entryDiv);
            });
        }
    }
    
    showSettings() {
        this.showScreen('settings-screen');
        this.loadSettings();
    }
    
    loadSettings() {
        const savedSettings = localStorage.getItem('nightmare-settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        
        // Apply settings to UI
        const volumeSlider = document.getElementById('volume-slider');
        const graphicsQuality = document.getElementById('graphics-quality');
        const motionEffects = document.getElementById('motion-effects');
        const hapticFeedback = document.getElementById('haptic-feedback');
        
        if (volumeSlider) volumeSlider.value = this.settings.volume;
        if (graphicsQuality) graphicsQuality.value = this.settings.graphicsQuality;
        if (motionEffects) motionEffects.checked = this.settings.motionEffects;
        if (hapticFeedback) hapticFeedback.checked = this.settings.hapticFeedback;
        
        // Apply theme
        document.body.setAttribute('data-theme', this.settings.theme);
        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) {
            const icons = { dark: '🌙', light: '☀️', oled: '⚫' };
            themeBtn.textContent = icons[this.settings.theme] || '🌙';
        }
    }
    
    saveSettings() {
        localStorage.setItem('nightmare-settings', JSON.stringify(this.settings));
    }
    
    toggleTheme() {
        const themes = ['dark', 'light', 'oled'];
        const currentIndex = themes.indexOf(this.settings.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.settings.theme = themes[nextIndex];
        
        document.body.setAttribute('data-theme', this.settings.theme);
        
        const themeBtn = document.getElementById('theme-btn');
        const icons = ['🌙', '☀️', '⚫'];
        if (themeBtn) themeBtn.textContent = icons[nextIndex];
        
        this.saveSettings();
    }
    
    updateGraphicsQuality() {
        // Adjust rendering quality based on settings
        const quality = this.settings.graphicsQuality;
        
        switch (quality) {
            case 'low':
                this.particleSystem.maxParticles = 25;
                break;
            case 'medium':
                this.particleSystem.maxParticles = 100;
                break;
            case 'high':
                this.particleSystem.maxParticles = 200;
                break;
            case 'ultra':
                this.particleSystem.maxParticles = 500;
                break;
        }
    }
}

// Player Class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocity = { x: 0, y: 0 };
        this.rotation = 0;
        this.speed = 3;
        this.jumpPower = 15;
        this.onGround = false;
        this.damaged = false;
        this.skillLevel = 1;
        this.radius = 15;
    }
    
    update(deltaTime, keys) {
        // Movement
        if (keys['KeyA'] || keys['ArrowLeft']) {
            this.velocity.x = -this.speed;
        } else if (keys['KeyD'] || keys['ArrowRight']) {
            this.velocity.x = this.speed;
        } else {
            this.velocity.x *= 0.8; // Friction
        }
        
        if (keys['KeyW'] || keys['ArrowUp']) {
            this.velocity.y = -this.speed;
        } else if (keys['KeyS'] || keys['ArrowDown']) {
            this.velocity.y = this.speed;
        } else {
            this.velocity.y *= 0.8;
        }
        
        // Running
        if (keys['ShiftLeft']) {
            this.velocity.x *= 1.5;
            this.velocity.y *= 1.5;
        }
        
        // Apply velocity
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Screen boundaries
        this.x = Math.max(15, Math.min(window.innerWidth - 15, this.x));
        this.y = Math.max(15, Math.min(window.innerHeight - 15, this.y));
        
        // Update skill level based on performance
        this.updateSkillLevel();
    }
    
    updateSkillLevel() {
        // AI-assisted skill calculation
        this.skillLevel += 0.001;
    }
}

// Enemy Class
class Enemy {
    constructor(x, y, type = 'demon') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.velocity = { x: 0, y: 0 };
        this.rotation = 0;
        this.speed = 1 + Math.random() * 2;
        this.health = 100;
        this.radius = 20;
        this.pathfindingData = [];
        this.lastPlayerPosition = { x: 0, y: 0 };
        this.isHallucination = false;
    }
    
    update(deltaTime, player, aiSystem) {
        if (!player) return;
        
        // AI-driven behavior
        const behavior = aiSystem.calculateEnemyBehavior(this, player);
        
        switch (behavior.type) {
            case 'chase':
                this.chasePlayer(player);
                break;
            case 'ambush':
                this.ambushPlayer(player);
                break;
            case 'patrol':
                this.patrol();
                break;
        }
        
        // Apply movement
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Screen boundaries
        this.x = Math.max(20, Math.min(window.innerWidth - 20, this.x));
        this.y = Math.max(20, Math.min(window.innerHeight - 20, this.y));
        
        // Update rotation to face movement direction
        this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
    }
    
    chasePlayer(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            this.velocity.x = (dx / distance) * this.speed;
            this.velocity.y = (dy / distance) * this.speed;
        }
        
        // Learn player routes for adaptive pathfinding
        this.pathfindingData.push({ x: player.x, y: player.y, time: Date.now() });
        if (this.pathfindingData.length > 100) {
            this.pathfindingData.shift();
        }
    }
    
    ambushPlayer(player) {
        // Predict player movement and position for ambush
        const prediction = this.predictPlayerMovement(player);
        const dx = prediction.x - this.x;
        const dy = prediction.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            this.velocity.x = (dx / distance) * this.speed * 1.5;
            this.velocity.y = (dy / distance) * this.speed * 1.5;
        }
    }
    
    patrol() {
        // Basic patrol behavior
        if (Math.random() < 0.01) {
            this.velocity.x = (Math.random() - 0.5) * this.speed;
            this.velocity.y = (Math.random() - 0.5) * this.speed;
        }
    }
    
    predictPlayerMovement(player) {
        // Simple prediction based on current velocity
        return {
            x: player.x + player.velocity.x * 10,
            y: player.y + player.velocity.y * 10
        };
    }
}

// Procedural Generator Class
class ProceduralGenerator {
    constructor() {
        this.seed = Math.random() * 1000000;
        this.noiseGenerator = new PerlinNoise(this.seed);
    }
    
    generateLevel(levelNumber) {
        // Seed-based generation for consistent levels
        const levelSeed = this.seed + levelNumber;
        
        const enemies = this.generateEnemies(levelNumber);
        const obstacles = this.generateObstacles(levelNumber);
        const powerUps = this.generatePowerUps(levelNumber);
        
        return { enemies, obstacles, powerUps };
    }
    
    generateEnemies(levelNumber) {
        const enemies = [];
        const enemyCount = Math.min(2 + Math.floor(levelNumber / 5), 8);
        
        for (let i = 0; i < enemyCount; i++) {
            const x = 50 + Math.random() * (window.innerWidth - 100);
            const y = 50 + Math.random() * (window.innerHeight - 100);
            const type = this.selectEnemyType(levelNumber);
            enemies.push(new Enemy(x, y, type));
        }
        
        return enemies;
    }
    
    selectEnemyType(levelNumber) {
        const types = ['demon', 'shadow', 'nightmare'];
        const weights = [
            Math.max(0, 100 - levelNumber * 2), // demons become less common
            Math.min(100, levelNumber * 1.5), // shadows increase
            Math.max(0, levelNumber - 50) // nightmares only after level 50
        ];
        
        return this.weightedRandom(types, weights);
    }
    
    generateObstacles(levelNumber) {
        const obstacles = [];
        const obstacleCount = Math.floor(levelNumber / 5) + 2;
        
        for (let i = 0; i < obstacleCount; i++) {
            obstacles.push({
                x: Math.random() * (window.innerWidth - 100),
                y: Math.random() * (window.innerHeight - 100),
                width: 30 + Math.random() * 70,
                height: 30 + Math.random() * 70,
                type: 'wall'
            });
        }
        
        return obstacles;
    }
    
    generatePowerUps(levelNumber) {
        const powerUps = [];
        const powerUpCount = Math.max(1, Math.floor(Math.random() * 3));
        
        for (let i = 0; i < powerUpCount; i++) {
            powerUps.push({
                x: 50 + Math.random() * (window.innerWidth - 100),
                y: 50 + Math.random() * (window.innerHeight - 100),
                type: this.selectPowerUpType(),
                radius: 10
            });
        }
        
        return powerUps;
    }
    
    selectPowerUpType() {
        const types = ['health', 'sanity', 'score'];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    weightedRandom(items, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        if (totalWeight === 0) return items[0];
        
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }
        
        return items[0];
    }
}

// Perlin Noise Implementation
class PerlinNoise {
    constructor(seed) {
        this.permutation = [];
        this.generatePermutation(seed);
    }
    
    generatePermutation(seed) {
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = i;
        }
        
        // Fisher-Yates shuffle with seed
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(this.seededRandom(seed + i) * (i + 1));
            [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
        }
        
        // Duplicate for overflow
        for (let i = 0; i < 256; i++) {
            this.permutation[256 + i] = this.permutation[i];
        }
    }
    
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
}

// Audio Engine Class
class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.volume = 0.7;
        this.sounds = {};
        this.ambientSource = null;
        this.initAudioContext();
    }
    
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    setVolume(volume) {
        this.volume = volume;
    }
    
    playSound(soundName) {
        // Generate procedural sound effects
        switch (soundName) {
            case 'damage':
                this.generateDamageSound();
                break;
            case 'powerup':
                this.generatePowerUpSound();
                break;
            case 'gameOver':
                this.generateGameOverSound();
                break;
            case 'levelComplete':
                this.generateLevelCompleteSound();
                break;
        }
    }
    
    generateDamageSound() {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            console.warn('Audio generation failed:', e);
        }
    }
    
    generatePowerUpSound() {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(this.volume * 0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (e) {
            console.warn('Audio generation failed:', e);
        }
    }
    
    generateGameOverSound() {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 2);
            
            gainNode.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 2);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 2);
        } catch (e) {
            console.warn('Audio generation failed:', e);
        }
    }
    
    generateLevelCompleteSound() {
        if (!this.audioContext) return;
        
        try {
            const frequencies = [261.63, 329.63, 392.00, 523.25];
            
            frequencies.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime + index * 0.1);
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + index * 0.1);
                gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, this.audioContext.currentTime + index * 0.1 + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + index * 0.1 + 0.3);
                
                oscillator.start(this.audioContext.currentTime + index * 0.1);
                oscillator.stop(this.audioContext.currentTime + index * 0.1 + 0.3);
            });
        } catch (e) {
            console.warn('Audio generation failed:', e);
        }
    }
    
    playAmbient(trackName) {
        this.generateAmbientHorror();
    }
    
    generateAmbientHorror() {
        if (!this.audioContext) return;
        
        try {
            const rumble = this.audioContext.createOscillator();
            const rumbleGain = this.audioContext.createGain();
            
            rumble.connect(rumbleGain);
            rumbleGain.connect(this.audioContext.destination);
            
            rumble.frequency.setValueAtTime(40, this.audioContext.currentTime);
            rumbleGain.gain.setValueAtTime(this.volume * 0.05, this.audioContext.currentTime);
            
            rumble.start(this.audioContext.currentTime);
            this.ambientSource = rumble;
        } catch (e) {
            console.warn('Ambient audio failed:', e);
        }
    }
    
    stopAmbient() {
        if (this.ambientSource) {
            try {
                this.ambientSource.stop();
                this.ambientSource = null;
            } catch (e) {
                console.warn('Stop ambient failed:', e);
            }
        }
    }
    
    applySanityEffects(sanityLevel) {
        // Apply audio distortion based on sanity
        if (!this.audioContext || !this.ambientSource) return;
        
        try {
            const distortionAmount = 1 - sanityLevel;
            this.ambientSource.frequency.setValueAtTime(
                40 + distortionAmount * 20,
                this.audioContext.currentTime
            );
        } catch (e) {
            console.warn('Sanity effects failed:', e);
        }
    }
}

// AI System Class
class AISystem {
    constructor() {
        this.difficultyMultiplier = 1;
        this.playerBehaviorData = [];
    }
    
    adjustDifficulty(playerSkillLevel, currentLevel) {
        const baseMultiplier = 1 + (currentLevel - 1) * 0.05;
        const skillAdjustment = Math.max(0.5, Math.min(2, playerSkillLevel / 5));
        
        this.difficultyMultiplier = baseMultiplier * skillAdjustment;
    }
    
    calculateEnemyBehavior(enemy, player) {
        const distance = Math.sqrt(
            Math.pow(enemy.x - player.x, 2) + Math.pow(enemy.y - player.y, 2)
        );
        
        this.recordPlayerBehavior(player);
        
        if (distance < 150) {
            return { type: 'chase', intensity: this.difficultyMultiplier };
        } else if (this.shouldAmbush(player)) {
            return { type: 'ambush', intensity: this.difficultyMultiplier * 1.5 };
        } else {
            return { type: 'patrol', intensity: this.difficultyMultiplier * 0.5 };
        }
    }
    
    recordPlayerBehavior(player) {
        this.playerBehaviorData.push({
            x: player.x,
            y: player.y,
            velocity: { ...player.velocity },
            timestamp: Date.now()
        });
        
        if (this.playerBehaviorData.length > 50) {
            this.playerBehaviorData.shift();
        }
    }
    
    shouldAmbush(player) {
        if (this.playerBehaviorData.length < 5) return false;
        
        const recent = this.playerBehaviorData.slice(-5);
        const avgVelocity = recent.reduce((sum, data) => ({
            x: sum.x + data.velocity.x,
            y: sum.y + data.velocity.y
        }), { x: 0, y: 0 });
        
        avgVelocity.x /= recent.length;
        avgVelocity.y /= recent.length;
        
        const velocityMagnitude = Math.sqrt(avgVelocity.x * avgVelocity.x + avgVelocity.y * avgVelocity.y);
        
        return velocityMagnitude > 2 && Math.random() < 0.05;
    }
}

// Physics Engine Class
class PhysicsEngine {
    constructor() {
        this.gravity = 0.3;
        this.friction = 0.9;
        this.objects = [];
    }
    
    addObject(object) {
        this.objects.push(object);
    }
    
    removeObject(object) {
        const index = this.objects.indexOf(object);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }
    
    update(deltaTime) {
        this.objects.forEach(object => {
            if (object.physics) {
                this.applyPhysics(object, deltaTime);
            }
        });
    }
    
    applyPhysics(object, deltaTime) {
        if (!object.onGround) {
            object.velocity.y += this.gravity;
        }
        
        object.velocity.x *= this.friction;
        
        object.x += object.velocity.x * deltaTime * 0.01;
        object.y += object.velocity.y * deltaTime * 0.01;
        
        if (object.y > window.innerHeight - 50) {
            object.y = window.innerHeight - 50;
            object.velocity.y = 0;
            object.onGround = true;
        } else {
            object.onGround = false;
        }
    }
}

// Particle System Class
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 100;
    }
    
    createParticle(x, y, options = {}) {
        if (this.particles.length >= this.maxParticles) {
            this.particles.shift();
        }
        
        const particle = {
            x: x,
            y: y,
            velocity: {
                x: (Math.random() - 0.5) * (options.spread || 5),
                y: (Math.random() - 0.5) * (options.spread || 5)
            },
            life: options.life || 1000,
            maxLife: options.life || 1000,
            color: options.color || '#ff0000',
            size: options.size || 2,
            alpha: 1
        };
        
        this.particles.push(particle);
    }
    
    createBloodSplatter(x, y) {
        for (let i = 0; i < 5; i++) {
            this.createParticle(x, y, {
                spread: 10,
                life: 1000,
                color: '#8b0000',
                size: 2
            });
        }
    }
    
    createPowerUpEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            this.createParticle(x, y, {
                spread: 15,
                life: 800,
                color: '#ffaa00',
                size: 3
            });
        }
    }
    
    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.velocity.x * deltaTime * 0.01;
            particle.y += particle.velocity.y * deltaTime * 0.01;
            particle.life -= deltaTime;
            particle.alpha = particle.life / particle.maxLife;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    render(ctx) {
        this.particles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.alpha;
            ctx.fillStyle = particle.color;
            ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
            ctx.restore();
        });
    }
}

// High Score Manager Class
class HighScoreManager {
    constructor() {
        this.dbName = 'NightmareSurvival';
        this.dbVersion = 1;
        this.db = null;
        this.initDB();
    }
    
    async initDB() {
        try {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('scores')) {
                    const store = db.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('score', 'score', { unique: false });
                    store.createIndex('mode', 'mode', { unique: false });
                }
            };
            
            request.onsuccess = () => {
                this.db = request.result;
            };
            
            request.onerror = () => {
                console.warn('IndexedDB not available');
            };
        } catch (e) {
            console.warn('Database initialization failed:', e);
        }
    }
    
    async saveScore(scoreData) {
        // Add timestamp and generate hash for anti-cheat
        scoreData.timestamp = Date.now();
        scoreData.hash = this.generateScoreHash(scoreData);
        
        try {
            if (this.db) {
                const transaction = this.db.transaction(['scores'], 'readwrite');
                const store = transaction.objectStore('scores');
                await store.add(scoreData);
            }
        } catch (error) {
            console.warn('Failed to save score to IndexedDB:', error);
        }
        
        // Always save to localStorage as backup
        this.saveToLocalStorage(scoreData);
    }
    
    generateScoreHash(scoreData) {
        const data = `${scoreData.score}-${scoreData.level}-${scoreData.time}-${scoreData.mode}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
    
    validateScore(scoreData) {
        const expectedHash = this.generateScoreHash(scoreData);
        return scoreData.hash === expectedHash;
    }
    
    saveToLocalStorage(scoreData) {
        try {
            const scores = JSON.parse(localStorage.getItem('nightmare-scores') || '[]');
            scores.push(scoreData);
            
            scores.sort((a, b) => b.score - a.score);
            scores.splice(50);
            
            localStorage.setItem('nightmare-scores', JSON.stringify(scores));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }
    
    getLeaderboard(mode = 'survival', limit = 10) {
        try {
            const scores = JSON.parse(localStorage.getItem('nightmare-scores') || '[]');
            
            return scores
                .filter(score => score.mode === mode && this.validateScore(score))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        } catch (e) {
            console.warn('Failed to load leaderboard:', e);
            return [];
        }
    }
}

// Initialize Game
document.addEventListener('DOMContentLoaded', () => {
    const game = new GameEngine();
    
    // Create background particles
    const particleContainer = document.getElementById('particle-container');
    
    function createBackgroundParticle() {
        if (!particleContainer) return;
        
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * window.innerWidth + 'px';
        particle.style.top = window.innerHeight + 'px';
        particle.style.animationDuration = (5 + Math.random() * 10) + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        
        particleContainer.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 15000);
    }
    
    // Create particles periodically
    setInterval(createBackgroundParticle, 3000);
    
    // Performance monitoring
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fps = 60;
    let performanceCheckInterval = 0;
    
    function updatePerformance() {
        const now = performance.now();
        frameCount++;
        
        if (frameCount % 60 === 0) {
            fps = Math.round(1000 / ((now - lastFrameTime) / 60));
            lastFrameTime = now;
            frameCount = 0;
            
            // Only adjust quality every 5 seconds to prevent spam
            performanceCheckInterval++;
            if (performanceCheckInterval >= 5 && fps < 40 && game.settings.graphicsQuality !== 'low') {
                game.settings.graphicsQuality = 'low';
                game.updateGraphicsQuality();
                console.log('Graphics quality auto-adjusted for performance');
                performanceCheckInterval = 0;
            }
        }
        
        requestAnimationFrame(updatePerformance);
    }
    
    updatePerformance();
});
