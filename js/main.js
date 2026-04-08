/**
 * main.js
 * GameScene, Phaser config, and lifecycle helpers (initGame / pauseGame / resumeGame).
 *
 * Load order (all before this file):
 *   bullet.js  →  asteroid.js  →  player.js  →  main.js
 */

/* ════════════════════════════════════════════════════════════════════════
   GameScene
════════════════════════════════════════════════════════════════════════ */
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  init() {
    // Called on first start AND on scene.restart()
    this.score     = 0;
    this.highScore = parseInt(localStorage.getItem('rq_spaceHighScore') || '0');
    this.gameOver  = false;
  }

  preload() {
    // Only load the profile image once; textures persist across restarts
    if (!this.textures.exists('profile')) {
      this.load.on('loaderror', (file) => {
        if (file.key === 'profile') this._makeFallbackProfile();
      });
      this.load.image('profile', 'Images/profilePhoto.png');
    }
  }

  create() {
    const { width, height } = this.scale;

    this._createTextures();
    this._createStarfield(width, height);

    // Game objects
    this.player    = new Player(this, width / 2, height / 2);
    this.bullets   = new BulletManager(this);
    this.asteroids = new AsteroidManager(this);
    this.asteroids.startSpawning();

    // Overlap: bullet destroys asteroid
    this.physics.add.overlap(
      this.bullets.group,
      this.asteroids.group,
      this._onBulletHitAsteroid,
      null, this
    );

    // Overlap: asteroid kills player
    this.physics.add.overlap(
      this.player.sprite,
      this.asteroids.group,
      this._onPlayerHit,
      null, this
    );

    this._createUI(width, height);
    this._showControls(width, height);

    // Reposition score on window resize
    this.scale.on('resize', (size) => {
      if (this.scoreTxt)     this.scoreTxt.setPosition(size.width - 16, 16);
      if (this.highScoreTxt) this.highScoreTxt.setPosition(size.width - 16, 44);
    });

    // Single click fires one bullet
    this.input.on('pointerdown', (p) => {
      if (p.leftButtonDown() && !this.gameOver) {
        this._shoot(p);
      }
    });

    // Hide the HTML loading overlay
    const loadingEl = document.getElementById('game-loading');
    if (loadingEl) {
      loadingEl.classList.add('hidden');
      setTimeout(() => { loadingEl.style.display = 'none'; }, 600);
    }
  }

  update(time, delta) {
    if (this.gameOver) return;

    const pointer = this.input.activePointer;
    this.player.update(pointer);
    this.bullets.update(delta);
    this.asteroids.cull();

    // Auto-fire while holding the left mouse button
    if (pointer.isDown && this.player.canFire(time)) {
      this._shoot(pointer);
      this.player.setLastFired(time);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  _shoot(pointer) {
    const angle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y,
      pointer.worldX, pointer.worldY
    );
    // Spawn bullet at the tip of the ship (30 px forward)
    const rot = this.player.rotation;
    const nx  = this.player.x + Math.sin(rot) * 30;
    const ny  = this.player.y - Math.cos(rot) * 30;
    this.bullets.fire(nx, ny, angle);
    this.player.setLastFired(this.time.now);
  }

  _onBulletHitAsteroid(bullet, asteroid) {
    // Deactivate both objects
    bullet.setActive(false).setVisible(false);
    bullet.body.enable = false;
    asteroid.setActive(false).setVisible(false);
    asteroid.body.enable = false;

    this._explode(asteroid.x, asteroid.y, false);

    // Update score
    this.score += 10;
    this.scoreTxt.setText('Score: ' + this.score);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('rq_spaceHighScore', this.highScore);
      this.highScoreTxt.setText('Best: ' + this.highScore);
    }
  }

  _onPlayerHit(playerSprite, asteroid) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.asteroids.stopSpawning();

    asteroid.setActive(false).setVisible(false);
    asteroid.body.enable = false;

    this._explode(playerSprite.x, playerSprite.y, true);
    this.player.die();

    this.time.delayedCall(950, () => this._showGameOver());
  }

  /**
   * Particle-burst explosion.
   * @param {boolean} large – bigger burst for player death
   */
  _explode(x, y, large) {
    const count  = large ? 18 : 9;
    const color  = large ? 0xFF6B6B : 0x6C63FF;
    const minDst = large ? 40 : 18;
    const maxDst = large ? 95 : 55;

    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const jitter    = Phaser.Math.FloatBetween(-0.25, 0.25);
      const dist      = Phaser.Math.Between(minDst, maxDst);

      const p = this.add.graphics().setDepth(50);
      p.fillStyle(color, 1);
      p.fillRect(-3, -3, 6, 6);
      p.setPosition(x, y);

      this.tweens.add({
        targets: p,
        x: x + Math.cos(baseAngle + jitter) * dist,
        y: y + Math.sin(baseAngle + jitter) * dist,
        alpha: 0,
        scaleX: 0.15,
        scaleY: 0.15,
        duration: Phaser.Math.Between(280, 550),
        ease: 'Power2Out',
        onComplete: () => p.destroy(),
      });
    }

    // Expanding ring flash
    const ring = this.add.graphics().setDepth(50);
    ring.lineStyle(large ? 3 : 2, 0xffffff, 0.9);
    ring.strokeCircle(x, y, large ? 18 : 10);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: large ? 3.2 : 2.5,
      scaleY: large ? 3.2 : 2.5,
      duration: 330,
      ease: 'Power2Out',
      onComplete: () => ring.destroy(),
    });
  }

  _showGameOver() {
    const { width, height } = this.scale;

    // Semi-transparent overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x080b14, 0.82)
      .setDepth(200);

    this.add.text(width / 2, height / 2 - 74, 'GAME OVER', {
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: '52px',
      fill: '#6C63FF',
      stroke: '#080b14',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(201);

    this.add.text(width / 2, height / 2 - 10, `Score: ${this.score}`, {
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: '28px',
      fill: '#e8eaf0',
    }).setOrigin(0.5).setDepth(201);

    this.add.text(width / 2, height / 2 + 36, `Best: ${this.highScore}`, {
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: '18px',
      fill: '#9C8FFF',
    }).setOrigin(0.5).setDepth(201);

    const btn = this.add.text(width / 2, height / 2 + 100, '[ PLAY AGAIN ]', {
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: '22px',
      fill: '#6C63FF',
    }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ fill: '#9C8FFF' }));
    btn.on('pointerout',  () => btn.setStyle({ fill: '#6C63FF' }));
    btn.on('pointerdown', () => {
      // Briefly show loading dots while scene restarts
      const el = document.getElementById('game-loading');
      if (el) { el.style.display = 'flex'; el.classList.remove('hidden'); }
      this.scene.restart();
    });
  }

  _createUI(width, height) {
    const base = {
      fontFamily: "'Space Grotesk', sans-serif",
      stroke: '#080b14',
      strokeThickness: 3,
    };
    this.scoreTxt = this.add.text(width - 16, 16, 'Score: 0', {
      ...base, fontSize: '20px', fill: '#e8eaf0',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.highScoreTxt = this.add.text(width - 16, 44, `Best: ${this.highScore}`, {
      ...base, fontSize: '14px', fill: '#9C8FFF',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
  }

  _showControls(width, height) {
    const txt = this.add.text(
      width / 2, height - 22,
      'WASD  ·  Move       Mouse  ·  Aim       Click  ·  Shoot',
      {
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        fill: '#8892b0',
        stroke: '#080b14',
        strokeThickness: 2,
      }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);

    this.tweens.add({
      targets: txt,
      alpha: 0,
      delay: 3200,
      duration: 1400,
      ease: 'Power2In',
      onComplete: () => txt.destroy(),
    });
  }

  _createStarfield(width, height) {
    const g = this.add.graphics().setDepth(0);
    for (let i = 0; i < 160; i++) {
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.05, 0.3));
      g.fillCircle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.4, 1.8)
      );
    }
  }

  // ── Procedural textures ─────────────────────────────────────────────────
  // All textures are generated at runtime so no external PNG files are needed.
  // Textures persist in the cache across scene restarts (checked with exists()).

  _createTextures() {
    // ── Ship (60 × 62 canvas, tip pointing UP) ──────────────────────────
    if (!this.textures.exists('ship')) {
      const g = this.make.graphics({ add: false });
      // Outer glow triangle
      g.fillStyle(0x6C63FF, 0.07);
      g.fillTriangle(30, 0, 0, 64, 60, 64);
      // Main body
      g.fillStyle(0x141826, 1);
      g.fillTriangle(30, 8, 6, 58, 54, 58);
      // Glowing edge
      g.lineStyle(2.5, 0x6C63FF, 1);
      g.strokeTriangle(30, 8, 6, 58, 54, 58);
      // Inner accent lines
      g.lineStyle(1.5, 0x9C8FFF, 0.4);
      g.beginPath(); g.moveTo(30, 16); g.lineTo(12, 54); g.strokePath();
      g.beginPath(); g.moveTo(30, 16); g.lineTo(48, 54); g.strokePath();
      // Engine exhaust bar
      g.fillStyle(0x9C8FFF, 0.55);
      g.fillRect(16, 55, 28, 4);
      g.generateTexture('ship', 60, 62);
      g.destroy();
    }

    // ── Bullet (12 × 12 canvas — cube / diamond appearance) ─────────────
    if (!this.textures.exists('bullet')) {
      const g = this.make.graphics({ add: false });
      // Soft glow
      g.fillStyle(0x9C8FFF, 0.18);
      g.fillRect(0, 0, 12, 12);
      // Bright core
      g.fillStyle(0xffffff, 1);
      g.fillRect(3, 3, 6, 6);
      // Edge accent
      g.lineStyle(1, 0x6C63FF, 0.8);
      g.strokeRect(3, 3, 6, 6);
      g.generateTexture('bullet', 12, 12);
      g.destroy();
    }

    // ── Asteroid (64 × 64 canvas — irregular rocky polygon) ─────────────
    if (!this.textures.exists('asteroid')) {
      const g = this.make.graphics({ add: false });
      const pts = [
        { x: 32, y:  4 }, { x: 50, y:  8 }, { x: 62, y: 22 },
        { x: 60, y: 40 }, { x: 50, y: 58 }, { x: 34, y: 62 },
        { x: 16, y: 58 }, { x:  4, y: 44 }, { x:  4, y: 24 },
        { x: 16, y: 10 },
      ];
      // Subtle outer glow
      const glow = pts.map(p => ({
        x: p.x + (p.x - 32) * 0.14,
        y: p.y + (p.y - 32) * 0.14,
      }));
      g.fillStyle(0x5a6380, 0.10);
      g.fillPoints(glow, true);
      // Rock fill
      g.fillStyle(0x1e2540, 1);
      g.fillPoints(pts, true);
      // Rocky edge
      g.lineStyle(2, 0x7a85a0, 1);
      g.strokePoints(pts, true);
      // Surface detail lines (craters / cracks)
      g.lineStyle(1, 0x4a5570, 0.55);
      g.beginPath(); g.moveTo(22, 24); g.lineTo(38, 18); g.strokePath();
      g.beginPath(); g.moveTo(36, 44); g.lineTo(52, 36); g.strokePath();
      g.fillStyle(0x2a3050, 0.65);
      g.fillCircle(24, 38, 5);
      g.fillCircle(42, 26, 4);
      g.generateTexture('asteroid', 64, 64);
      g.destroy();
    }
  }

  /** Fallback profile avatar if the image fails to load. */
  _makeFallbackProfile() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x1e2540, 1);
    g.fillCircle(16, 16, 16);
    g.fillStyle(0x9C8FFF, 0.85);
    g.fillCircle(16, 13, 6);
    g.fillEllipse(16, 24, 18, 12);
    g.generateTexture('profile', 32, 32);
    g.destroy();
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Phaser config & lifecycle helpers
   Called from index.html's navigate() function.
════════════════════════════════════════════════════════════════════════ */

// Exposed as globals so index.html's inline <script> can call them.
let _phaserGame = null;

const GAME_CONFIG = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#080b14',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode:       Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: GameScene,
};

function initGame() {
  if (_phaserGame) return;
  _phaserGame = new Phaser.Game(GAME_CONFIG);
}

function destroyGame() {
  if (_phaserGame) {
    _phaserGame.destroy(true);
    _phaserGame = null;
  }
  // Show the loading overlay so it's ready for the next visit
  const el = document.getElementById('game-loading');
  if (el) { el.style.display = 'flex'; el.classList.remove('hidden'); }
}

function pauseGame() {
  if (_phaserGame && _phaserGame.scene.isActive('GameScene')) {
    _phaserGame.scene.pause('GameScene');
  }
}

function resumeGame() {
  if (_phaserGame && _phaserGame.scene.isPaused('GameScene')) {
    _phaserGame.scene.resume('GameScene');
  }
}
