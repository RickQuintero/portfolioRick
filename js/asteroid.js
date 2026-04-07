/**
 * asteroid.js
 * Spawns and manages a pool of rotating asteroid sprites.
 */
class AsteroidManager {
  static MIN_SPEED  = 65;
  static MAX_SPEED  = 155;
  static MAX_COUNT  = 20;
  static INIT_DELAY = 2200; // ms between spawns at start
  static MIN_DELAY  = 650;  // minimum spawn interval (gets faster over time)

  constructor(scene) {
    this.scene  = scene;
    this.group  = scene.physics.add.group(); // used for overlap detection
    this._pool  = [];
    this._delay = AsteroidManager.INIT_DELAY;
    this._timer = null;
  }

  /** Begin the spawn cycle. Call once from scene create(). */
  startSpawning() {
    this._scheduleNext();
  }

  /** Halt the spawn cycle (call on game over). */
  stopSpawning() {
    if (this._timer) {
      this._timer.remove(false);
      this._timer = null;
    }
  }

  /** Deactivate asteroids that drifted off-screen. Call in scene update(). */
  cull() {
    const { width, height } = this.scene.scale;
    this._pool.forEach(a => {
      if (!a.active) return;
      if (
        a.x < -150 || a.x > width  + 150 ||
        a.y < -150 || a.y > height + 150
      ) {
        a.setActive(false).setVisible(false);
        a.body.enable = false;
      }
    });
  }

  // ── private ──────────────────────────────────────────────────────────────

  _scheduleNext() {
    this._timer = this.scene.time.delayedCall(this._delay, () => {
      if (!this.scene.gameOver) {
        this._spawn();
        // Gradually shorten the interval (game gets harder)
        this._delay = Math.max(AsteroidManager.MIN_DELAY, this._delay - 70);
      }
      this._scheduleNext();
    });
  }

  _spawn() {
    const { width, height } = this.scene.scale;

    // Pick a random edge to spawn from
    const side = Phaser.Math.Between(0, 3);
    let x, y;
    switch (side) {
      case 0:  x = Phaser.Math.Between(0, width);  y = -60;          break;
      case 1:  x = width  + 60; y = Phaser.Math.Between(0, height);  break;
      case 2:  x = Phaser.Math.Between(0, width);  y = height + 60;  break;
      default: x = -60;         y = Phaser.Math.Between(0, height);
    }

    const a = this._acquire(x, y);
    if (!a) return;

    a.body.reset(x, y);
    a.setActive(true).setVisible(true);
    a.body.enable = true;
    a.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

    // Random scale so asteroids feel varied
    const scale = Phaser.Math.FloatBetween(0.6, 1.45);
    a.setScale(scale);

    // Aim roughly at the center of the screen with a random offset
    const tx  = width  / 2 + Phaser.Math.Between(-180, 180);
    const ty  = height / 2 + Phaser.Math.Between(-180, 180);
    const spd = Phaser.Math.Between(AsteroidManager.MIN_SPEED, AsteroidManager.MAX_SPEED);
    const ang = Phaser.Math.Angle.Between(x, y, tx, ty);

    a.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
    a.body.setAngularVelocity(Phaser.Math.Between(-55, 55));
  }

  _acquire(x, y) {
    for (const a of this._pool) {
      if (!a.active) return a;
    }
    if (this._pool.length < AsteroidManager.MAX_COUNT) {
      const a = this.scene.physics.add.sprite(x, y, 'asteroid');
      // Circular hitbox centered on the 64×64 texture (radius 24, offset = 32-24 = 8)
      a.body.setCircle(24, 8, 8);
      a.setDepth(6);
      this.group.add(a);
      this._pool.push(a);
      return a;
    }
    return null; // pool exhausted
  }
}
