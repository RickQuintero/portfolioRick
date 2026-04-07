/**
 * bullet.js
 * Manages a pool of arcade-physics bullet sprites.
 */
class BulletManager {
  static SPEED    = 760;
  static LIFESPAN = 1700; // ms
  static MAX      = 30;

  constructor(scene) {
    this.scene = scene;
    this.group = scene.physics.add.group(); // used for overlap detection
    this._pool = [];
  }

  /**
   * Spawn a bullet from (x, y) traveling at angle (radians, Phaser convention:
   * 0 = right, PI/2 = down).
   */
  fire(x, y, angle) {
    const b = this._acquire(x, y);
    if (!b) return;

    b.body.reset(x, y);
    b.setActive(true).setVisible(true);
    b.body.enable = true;
    b.body.setVelocity(
      Math.cos(angle) * BulletManager.SPEED,
      Math.sin(angle) * BulletManager.SPEED
    );
    // 45° rotation gives the square a diamond / cube look
    b.setRotation(angle + Math.PI / 4);
    b._lifespan = BulletManager.LIFESPAN;
  }

  /** Call every frame from the scene's update(delta). */
  update(delta) {
    const { width, height } = this.scene.scale;
    this._pool.forEach(b => {
      if (!b.active) return;
      b._lifespan -= delta;
      if (
        b._lifespan <= 0 ||
        b.x < -80 || b.x > width  + 80 ||
        b.y < -80 || b.y > height + 80
      ) {
        b.setActive(false).setVisible(false);
        b.body.enable = false;
      }
    });
  }

  // ── private ──────────────────────────────────────────────────────────────

  _acquire(x, y) {
    // Reuse an inactive bullet from the pool first
    for (const b of this._pool) {
      if (!b.active) return b;
    }
    // Create a new one if under the limit
    if (this._pool.length < BulletManager.MAX) {
      const b = this.scene.physics.add.sprite(x, y, 'bullet');
      b._lifespan = 0;
      b.setDepth(8);
      this.group.add(b);
      this._pool.push(b);
      return b;
    }
    return null; // pool exhausted
  }
}
