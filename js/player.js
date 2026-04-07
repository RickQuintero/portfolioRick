/**
 * player.js
 * The player's triangular ship with a circular profile-photo overlay.
 *
 *  - WASD:  world-space movement
 *  - Mouse: ship rotates to always face the cursor
 */
class Player {
  static SPEED = 275; // px/s

  constructor(scene, x, y) {
    this.scene      = scene;
    this._lastFired = 0;
    this.fireRate   = 175; // ms minimum between shots
    this.alive      = true;

    // ── Physics sprite ───────────────────────────────────────────────────
    this.sprite = scene.physics.add.sprite(x, y, 'ship');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);
    // Tight circular hitbox: radius 16, centered on 60×62 texture
    // body top-left = sprite center - half-size → offset = halfSize - radius
    this.sprite.body.setCircle(16, 14, 15);

    // ── Circular profile-photo crop ──────────────────────────────────────
    this._profileImg = scene.add.image(x, y, 'profile');
    this._profileImg.setDisplaySize(28, 28);
    this._profileImg.setDepth(12);

    // Geometry mask for the circular crop (redrawn every frame in update)
    this._maskGfx = scene.make.graphics({ add: false });
    this._maskGfx.fillStyle(0xffffff);
    this._maskGfx.fillCircle(x, y, 14);
    this._profileImg.setMask(this._maskGfx.createGeometryMask());

    // ── Thruster glow graphics (drawn manually each frame) ───────────────
    this._thrusterGfx = scene.add.graphics().setDepth(9);

    // ── Keyboard input ───────────────────────────────────────────────────
    this._keys = scene.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  /**
   * Update movement, rotation, profile position, and thruster.
   * @param {Phaser.Input.Pointer} pointer – active pointer for aiming
   */
  update(pointer) {
    if (!this.alive) return;

    const { sprite, _keys } = this;

    // ── Rotate to face cursor ────────────────────────────────────────────
    // Phaser.Math.Angle.Between returns 0 = right, PI/2 = down.
    // Our ship texture points UP, so we add PI/2 to align the tip to the angle.
    const aimAngle = Phaser.Math.Angle.Between(
      sprite.x, sprite.y,
      pointer.worldX, pointer.worldY
    );
    sprite.setRotation(aimAngle + Math.PI / 2);

    // ── WASD world-space movement ────────────────────────────────────────
    let vx = 0, vy = 0;
    if (_keys.left.isDown)  vx -= Player.SPEED;
    if (_keys.right.isDown) vx += Player.SPEED;
    if (_keys.up.isDown)    vy -= Player.SPEED;
    if (_keys.down.isDown)  vy += Player.SPEED;

    // Normalize diagonal so speed stays consistent
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    sprite.setVelocity(vx, vy);

    // ── Sync profile image + geometry mask to ship position ──────────────
    const px = sprite.x, py = sprite.y;
    this._profileImg.setPosition(px, py);

    this._maskGfx.clear();
    this._maskGfx.fillStyle(0xffffff);
    this._maskGfx.fillCircle(px, py, 14);

    // ── Thruster glow at the ship's exhaust (opposite of the tip) ────────
    this._thrusterGfx.clear();
    if (vx !== 0 || vy !== 0) {
      const rot = sprite.rotation;
      // "Back" of ship: invert the facing direction
      const bx = px - Math.sin(rot) * 24;
      const by = py + Math.cos(rot) * 24;

      this._thrusterGfx.fillStyle(0x6C63FF, 0.28);
      this._thrusterGfx.fillCircle(bx, by, 11);
      this._thrusterGfx.fillStyle(0xffffff, 0.85);
      this._thrusterGfx.fillCircle(bx, by, 3);
    }
  }

  /** True if enough time has passed to fire again. */
  canFire(time) { return time > this._lastFired + this.fireRate; }

  /** Record the firing timestamp. */
  setLastFired(time) { this._lastFired = time; }

  /** Play the death animation. */
  die() {
    this.alive = false;
    this.sprite.setVelocity(0, 0);
    this._thrusterGfx.clear();
    this.scene.tweens.add({
      targets: [this.sprite, this._profileImg],
      alpha: 0,
      duration: 700,
      ease: 'Power2',
    });
  }

  /** Convenience getters for position and rotation. */
  get x()        { return this.sprite.x; }
  get y()        { return this.sprite.y; }
  get rotation() { return this.sprite.rotation; }
}
