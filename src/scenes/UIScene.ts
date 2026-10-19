import Phaser from 'phaser';
import { FONT, GAME_H, MAP_W, PANEL_W, TILE } from '../config/constants';
import { ENEMIES } from '../config/enemies';
import { SPELLS, SPELL_ORDER, type SpellKey } from '../config/spells';
import { TOWER_ORDER, type TargetMode, type TowerDef, type TowerKey } from '../config/towers';
import { Button } from '../ui/Button';
import { isTouchDevice } from '../ui/touch';
import type { GameScene } from './GameScene';

const X = MAP_W + 8;
const W = PANEL_W - 16;

// Panel layout (y positions). Buttons are 28 pixels tall so they are easy to hit with a finger.
const SHOP_Y = 40;
const SHOP_STEP = 32;
const SHOP_H = 30;
const INFO_Y = 204;
const INFO_H = 104;
const PREVIEW_ROWS = 6;
const BTN_H = 28;
const ROW_STEP = BTN_H + 4;
const ACTION_Y = INFO_Y + INFO_H + 4;
const SPELL_Y = ACTION_Y + 2 * ROW_STEP;
const START_Y = SPELL_Y + ROW_STEP;
const SPEED_Y = START_Y + ROW_STEP;

const TARGET_LABEL: Record<TargetMode, string> = { first: 'FIRST', strongest: 'STRONG', closest: 'CLOSE' };

interface ShopItem {
  key: TowerKey;
  button: Button;
  parts: Phaser.GameObjects.Components.Alpha[];
  lock: Phaser.GameObjects.Image;
  lockText: Phaser.GameObjects.Text;
}

/** Right-hand HUD. Polls the game scene each frame and forwards button presses to it. */
export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private livesText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private shop: ShopItem[] = [];
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private previewIcons: Phaser.GameObjects.Image[] = [];
  private previewTexts: Phaser.GameObjects.Text[] = [];
  private upgradeBtn!: Button;
  private sellBtn!: Button;
  private targetBtn!: Button;
  private spellBtns!: Record<SpellKey, Button>;
  private startBtn!: Button;
  private speedBtn!: Button;
  private pauseBtn!: Button;
  private quitBtn!: Button;
  private cancelBtn!: Button;

  constructor() {
    super('UI');
  }

  create(): void {
    this.gs = this.scene.get('Game') as GameScene;
    this.shop = [];
    this.previewIcons = [];
    this.previewTexts = [];

    const g = this.add.graphics();
    g.fillStyle(0x1a1c2c, 1).fillRect(MAP_W, 0, PANEL_W, GAME_H);
    g.fillStyle(0x333c57, 1).fillRect(MAP_W, 0, 2, GAME_H);
    g.fillStyle(0x262b3e, 1).fillRect(X, INFO_Y, W, INFO_H);
    g.lineStyle(1, 0x333c57, 1).strokeRect(X + 0.5, INFO_Y + 0.5, W - 1, INFO_H - 1);

    this.add.image(X + 6, 11, 'icon_heart').setOrigin(0.5);
    this.livesText = this.text(X + 16, 7, '');
    this.add.image(X + 78, 11, 'icon_coin').setOrigin(0.5);
    this.moneyText = this.text(X + 88, 7, '', '#ffcd75');
    this.waveText = this.text(X + 2, 24, '');
    const d = this.gs.difficulty;
    if (this.gs.custom) this.text(X + W - 2, 24, 'CUSTOM', '#73eff7').setOrigin(1, 0);
    else this.text(X + W - 2, 24, d.name.toUpperCase(), d.color).setOrigin(1, 0);

    TOWER_ORDER.forEach((key, i) => this.makeShopItem(key, i, SHOP_Y + i * SHOP_STEP));

    this.infoTitle = this.text(X + 6, INFO_Y + 6, '', '#ffcd75');
    this.infoBody = this.text(X + 6, INFO_Y + 22, '', '#d0dae2').setLineSpacing(4).setWordWrapWidth(W - 12);
    for (let i = 0; i < PREVIEW_ROWS; i++) {
      const y = INFO_Y + 30 + i * 13;
      this.previewIcons.push(this.add.image(X + 14, y, 'px').setScale(0.4).setVisible(false));
      this.previewTexts.push(this.text(X + 26, y - 4, '').setVisible(false));
    }

    const half = (W - 4) / 2;
    const sellY = ACTION_Y + ROW_STEP;
    this.upgradeBtn = new Button(this, { x: X, y: ACTION_Y, w: W, h: BTN_H, label: '', variant: 'primary', onClick: () => this.gs.upgradeSelected() });
    this.sellBtn = new Button(this, { x: X, y: sellY, w: half, h: BTN_H, label: '', variant: 'danger', onClick: () => this.gs.sellSelected() });
    this.targetBtn = new Button(this, { x: X + half + 4, y: sellY, w: half, h: BTN_H, label: '', onClick: () => this.gs.cycleTargetSelected() });
    // Phones have no right-click or Esc, so placing a tower or aiming the meteor gets a button to stop.
    this.cancelBtn = new Button(this, { x: X, y: ACTION_Y, w: W, h: BTN_H, label: 'CANCEL', variant: 'danger', onClick: () => this.gs.cancelAll() });
    this.quitBtn = new Button(this, {
      x: X,
      y: ACTION_Y,
      w: W,
      h: BTN_H,
      label: this.gs.custom ? 'BACK TO CREATOR' : 'MAIN MENU',
      variant: 'danger',
      onClick: () => this.gs.quit(),
    });

    this.spellBtns = {} as Record<SpellKey, Button>;
    SPELL_ORDER.forEach((key, i) => {
      this.spellBtns[key] = new Button(this, {
        x: X + i * (half + 4),
        y: SPELL_Y,
        w: half,
        h: BTN_H,
        label: '',
        variant: 'accent',
        onClick: () => this.gs.castSpell(key),
      });
    });

    this.startBtn = new Button(this, { x: X, y: START_Y, w: W, h: BTN_H, label: 'START WAVE', variant: 'primary', onClick: () => this.gs.startNextWave() });
    this.speedBtn = new Button(this, { x: X, y: SPEED_Y, w: half, h: BTN_H, label: '', onClick: () => this.gs.toggleSpeed() });
    this.pauseBtn = new Button(this, { x: X + half + 4, y: SPEED_Y, w: half, h: BTN_H, label: '', onClick: () => this.gs.togglePause() });
    if (!isTouchDevice()) this.text(X + W / 2, SPEED_Y + BTN_H + 3, 'Q METEOR  W FREEZE', '#566c86').setOrigin(0.5, 0);
  }

  update(): void {
    const gs = this.gs;
    const { money, lives } = gs.economy;

    this.livesText.setText(String(lives)).setColor(lives <= 5 ? '#ef7d57' : '#f4f4f4');
    this.moneyText.setText(String(money));
    this.waveText.setText(`WAVE ${Math.max(gs.waves.current, 1)}/${gs.waves.total}`);

    for (const item of this.shop) {
      const def = gs.towerDefs[item.key];
      const unlocked = gs.isUnlocked(item.key);
      const affordable = money >= def.cost;
      item.button.setEnabled(unlocked && affordable && !gs.isOver).setActive(gs.placement.type === item.key);
      item.parts.forEach((p) => p.setAlpha(unlocked && affordable ? 1 : 0.4));
      item.lock.setVisible(!unlocked);
      item.lockText.setVisible(!unlocked);
    }

    this.updateInfo();

    for (const key of SPELL_ORDER) {
      const cd = gs.spellCooldown[key];
      const label = cd > 0 ? `${Math.ceil(cd)}s` : SPELLS[key].name.toUpperCase();
      this.spellBtns[key]
        .setLabel(label)
        .setEnabled(gs.spellReady(key))
        .setActive(key === 'meteor' && gs.aimingMeteor);
    }

    if (gs.phase === 'wave') this.startBtn.setLabel(`ENEMIES ${gs.enemiesAlive}`).setEnabled(false);
    else if (gs.isOver) this.startBtn.setLabel('GAME OVER').setEnabled(false);
    else if (gs.countdown > 0) this.startBtn.setLabel(`NEXT IN ${Math.ceil(gs.countdown)}s`).setEnabled(true);
    else this.startBtn.setLabel('START WAVE').setEnabled(true);

    this.speedBtn.setLabel(gs.speed === 2 ? '>> 2X' : '> 1X').setActive(gs.speed === 2);
    this.pauseBtn.setLabel(gs.paused ? 'PLAY' : 'PAUSE').setActive(gs.paused);
  }

  private updateInfo(): void {
    const gs = this.gs;
    const t = gs.selected;
    const paused = gs.paused && !gs.isOver;
    this.quitBtn.setVisible(paused);
    this.cancelBtn.setVisible(!paused && gs.isChoosing && !gs.isOver);
    this.showPreview(false);
    this.upgradeBtn.setVisible(false);
    this.sellBtn.setVisible(false);
    this.targetBtn.setVisible(false);

    if (paused) {
      this.infoTitle.setText('PAUSED');
      this.infoBody.setText(gs.custom ? 'Press PLAY to\ncarry on, or go\nback to change\nyour level.' : 'Press PLAY to\ncarry on, or\nleave this game.');
      return;
    }
    if (gs.aimingMeteor) {
      this.infoTitle.setText('METEOR');
      this.infoBody.setText(
        gs.touchMode
          ? 'Tap the map to\naim, then tap\ninside the\ncircle to drop\nit.'
          : 'Click the map\nto drop it.\n\nRight-click or\nESC to cancel.',
      );
      return;
    }
    if (t) {
      const next = t.isMaxLevel ? null : t.level + 1;
      this.infoTitle.setText(`${t.def.name.toUpperCase()} LV${t.level + 1}`);
      this.infoBody.setText(statLines(t.def, t.level, next));
      const cost = t.upgradeCost;
      this.upgradeBtn
        .setVisible(true)
        .setLabel(cost === null ? 'MAX LEVEL' : `UPGRADE ${cost}`)
        .setEnabled(cost !== null && gs.economy.canAfford(cost));
      this.sellBtn.setVisible(true).setLabel(`SELL ${t.sellValue}`);
      this.targetBtn.setVisible(true).setLabel(TARGET_LABEL[t.targetMode]);
      return;
    }
    const placing = gs.placement.type;
    if (placing) {
      const def = gs.towerDefs[placing];
      this.infoTitle.setText(def.name.toUpperCase());
      const s0 = def.levels[0];
      const stats = `DMG ${s0.damage} RNG ${(s0.range / TILE).toFixed(1)}`;
      // On touch the first tap only previews, so say how to build.
      const hint = gs.touchMode ? (gs.placement.hover ? 'Tap the same\ntile again to\nbuild it.' : 'Tap a grass\ntile to see\nwhere it goes.') : '';
      this.infoBody.setText(hint ? `${stats}\n\n${hint}` : `${def.description}\n\n${stats}`);
      return;
    }
    const preview = gs.nextWavePreview();
    if (!preview) {
      this.infoTitle.setText('FINAL WAVE!');
      this.infoBody.setText('Hold on!');
      return;
    }
    this.infoTitle.setText(`${gs.phase === 'wave' ? 'NEXT' : 'COMING'}: WAVE ${preview.wave}`);
    this.infoBody.setText('');
    this.showPreview(true, preview.items);
  }

  /** One row per enemy type in the coming wave: icon, count and name. */
  private showPreview(show: boolean, items: { enemy: keyof typeof ENEMIES; count: number }[] = []): void {
    for (let i = 0; i < PREVIEW_ROWS; i++) {
      const item = show ? items[i] : undefined;
      const icon = this.previewIcons[i];
      const text = this.previewTexts[i];
      icon.setVisible(!!item);
      text.setVisible(!!item);
      if (!item) continue;
      const def = ENEMIES[item.enemy];
      icon.setTexture(`${def.texture}_0`).setScale(0.45);
      text.setText(`${String(item.count).padStart(2)} ${def.name.toUpperCase()}`).setColor(def.boss ? '#ef7d57' : '#d0dae2');
    }
  }

  private makeShopItem(key: TowerKey, index: number, y: number): void {
    const def = this.gs.towerDefs[key];
    const button = new Button(this, { x: X, y, w: W, h: SHOP_H, onClick: () => this.gs.beginPlacement(key) });
    const cy = y + SHOP_H / 2;
    const base = this.add.image(X + 16, cy, def.baseTexture).setScale(0.8);
    const head = this.add.image(X + 16, cy, def.headTexture).setScale(0.8).setRotation(def.rotates ? -Math.PI / 4 : 0);
    const name = this.text(X + 34, y + 5, def.name.toUpperCase());
    const coin = this.add.image(X + 38, y + 21, 'icon_coin').setScale(0.75);
    const cost = this.text(X + 46, y + 17, String(def.cost), '#ffcd75');
    const hotkey = this.text(X + W - 10, y + 4, String(index + 1), '#566c86');
    const lock = this.add.image(X + W - 34, y + 21, 'icon_lock').setVisible(false);
    const lockText = this.text(X + W - 24, y + 17, `W${def.unlockWave ?? ''}`, '#94b0c2').setVisible(false);
    this.shop.push({ key, button, parts: [base, head, name, coin, cost, hotkey], lock, lockText });
  }

  private text(x: number, y: number, str: string, color = '#f4f4f4'): Phaser.GameObjects.Text {
    return this.add.text(x, y, str, { fontFamily: FONT, fontSize: '8px', color });
  }
}

/** Stat block for a tower level, with "> next" values when an upgrade exists. */
function statLines(def: TowerDef, level: number, next: number | null): string {
  const s = def.levels[level];
  const n = next === null ? null : def.levels[next];
  const fmt = (label: string, a: string, b?: string) => `${label.padEnd(5)}${a}${b && b !== a ? `>${b}` : ''}`;
  const lines = [
    fmt('DMG', String(s.damage), n ? String(n.damage) : undefined),
    fmt('RNG', (s.range / TILE).toFixed(1), n ? (n.range / TILE).toFixed(1) : undefined),
    fmt('RATE', (1 / s.cooldown).toFixed(1), n ? (1 / n.cooldown).toFixed(1) : undefined),
  ];
  if (s.splash > 0 || (n && n.splash > 0)) {
    lines.push(fmt('AREA', (s.splash / TILE).toFixed(1), n ? (n.splash / TILE).toFixed(1) : undefined));
  }
  if (s.slow) {
    const pct = (f: number) => `${Math.round((1 - f) * 100)}%`;
    lines.push(fmt('SLOW', pct(s.slow.factor), n?.slow ? pct(n.slow.factor) : undefined));
  }
  if (s.chain) lines.push(fmt('JUMP', String(s.chain.count), n?.chain ? String(n.chain.count) : undefined));
  const tags = [def.hitsAir ? 'AIR' : 'GROUND', def.pierce ? 'PIERCE' : ''].filter(Boolean).join(' ');
  lines.push(tags);
  return lines.join('\n');
}
