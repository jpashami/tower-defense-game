import Phaser from 'phaser';
import { FONT, GAME_H, MAP_W, PANEL_W, TILE } from '../config/constants';
import { TOWERS, TOWER_ORDER, type TowerDef, type TowerKey } from '../config/towers';
import { Button } from '../ui/Button';
import type { GameScene } from './GameScene';

const X = MAP_W + 8;
const W = PANEL_W - 16;

interface ShopItem {
  key: TowerKey;
  button: Button;
  parts: Phaser.GameObjects.Components.Alpha[];
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
  private upgradeBtn!: Button;
  private sellBtn!: Button;
  private startBtn!: Button;
  private speedBtn!: Button;
  private pauseBtn!: Button;

  constructor() {
    super('UI');
  }

  create(): void {
    this.gs = this.scene.get('Game') as GameScene;
    this.shop = [];

    const g = this.add.graphics();
    g.fillStyle(0x1a1c2c, 1).fillRect(MAP_W, 0, PANEL_W, GAME_H);
    g.fillStyle(0x333c57, 1).fillRect(MAP_W, 0, 2, GAME_H);
    // Info box frame.
    g.fillStyle(0x262b3e, 1).fillRect(X, 206, W, 190);
    g.lineStyle(1, 0x333c57, 1).strokeRect(X + 0.5, 206.5, W - 1, 189);

    this.add.image(X + 6, 13, 'icon_heart').setOrigin(0.5);
    this.livesText = this.text(X + 16, 9, '');
    this.add.image(X + 78, 13, 'icon_coin').setOrigin(0.5);
    this.moneyText = this.text(X + 88, 9, '', '#ffcd75');
    this.waveText = this.text(X + 2, 28, '');
    const d = this.gs.difficulty;
    this.text(X + W - 2, 28, d.name.toUpperCase(), d.color).setOrigin(1, 0);

    TOWER_ORDER.forEach((key, i) => this.makeShopItem(key, i, 48 + i * 52));

    this.infoTitle = this.text(X + 6, 214, '', '#ffcd75');
    this.infoBody = this.text(X + 6, 232, '', '#d0dae2').setLineSpacing(5).setWordWrapWidth(W - 12);

    this.upgradeBtn = new Button(this, { x: X + 4, y: 342, w: W - 8, h: 22, label: '', variant: 'primary', onClick: () => this.gs.upgradeSelected() });
    this.sellBtn = new Button(this, { x: X + 4, y: 368, w: W - 8, h: 22, label: '', variant: 'danger', onClick: () => this.gs.sellSelected() });
    this.startBtn = new Button(this, { x: X, y: 404, w: W, h: 30, label: 'START WAVE', variant: 'primary', onClick: () => this.gs.startNextWave() });
    this.speedBtn = new Button(this, { x: X, y: 442, w: 68, h: 28, label: '', onClick: () => this.gs.toggleSpeed() });
    this.pauseBtn = new Button(this, { x: X + W - 68, y: 442, w: 68, h: 28, label: '', onClick: () => this.gs.togglePause() });
  }

  update(): void {
    const gs = this.gs;
    const { money, lives } = gs.economy;

    this.livesText.setText(String(lives)).setColor(lives <= 5 ? '#ef7d57' : '#f4f4f4');
    this.moneyText.setText(String(money));
    this.waveText.setText(`WAVE ${Math.max(gs.waves.current, 1)}/${gs.waves.total}`);

    for (const item of this.shop) {
      const affordable = money >= TOWERS[item.key].cost;
      item.button.setEnabled(affordable && !gs.isOver).setActive(gs.placement.type === item.key);
      item.parts.forEach((p) => p.setAlpha(affordable ? 1 : 0.4));
    }

    this.updateInfo();

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
    if (t) {
      const next = t.isMaxLevel ? null : t.level + 1;
      this.infoTitle.setText(`${t.def.name.toUpperCase()} LV${t.level + 1}`);
      this.infoBody.setText(statLines(t.def, t.level, next));
      const cost = t.upgradeCost;
      this.upgradeBtn
        .setVisible(true)
        .setLabel(cost === null ? 'MAX LEVEL' : `UPGRADE ${cost}`)
        .setEnabled(cost !== null && gs.economy.canAfford(cost));
      this.sellBtn.setVisible(true).setLabel(`SELL +${t.sellValue}`);
      return;
    }
    this.upgradeBtn.setVisible(false);
    this.sellBtn.setVisible(false);

    const placing = gs.placement.type;
    if (placing) {
      const def = TOWERS[placing];
      this.infoTitle.setText(def.name.toUpperCase());
      this.infoBody.setText(`${def.description}\n\n${statLines(def, 0, null)}\n\nShift-click to\nbuild several.`);
      return;
    }
    this.infoTitle.setText('HOW TO PLAY');
    this.infoBody.setText(
      'Buy a tower,\nthen click on\ngrass to build.\n\nClick a tower\nto upgrade or\nsell it.\n\nGuard the castle\nfrom the horde!',
    );
  }

  private makeShopItem(key: TowerKey, index: number, y: number): void {
    const def = TOWERS[key];
    const button = new Button(this, { x: X, y, w: W, h: 48, onClick: () => this.gs.beginPlacement(key) });
    const cy = y + 24;
    const base = this.add.image(X + 22, cy, def.baseTexture);
    const head = this.add.image(X + 22, cy, def.headTexture).setRotation(def.rotates ? -Math.PI / 4 : 0);
    const name = this.text(X + 44, y + 10, def.name.toUpperCase());
    const coin = this.add.image(X + 48, y + 33, 'icon_coin');
    const cost = this.text(X + 58, y + 29, String(def.cost), '#ffcd75');
    const hotkey = this.text(X + W - 12, y + 6, String(index + 1), '#566c86');
    this.shop.push({ key, button, parts: [base, head, name, coin, cost, hotkey] });
  }

  private text(x: number, y: number, str: string, color = '#f4f4f4'): Phaser.GameObjects.Text {
    return this.add.text(x, y, str, { fontFamily: FONT, fontSize: '8px', color });
  }
}

/** Stat block for a tower level, with "> next" values when an upgrade exists. */
function statLines(def: TowerDef, level: number, next: number | null): string {
  const s = def.levels[level];
  const n = next === null ? null : def.levels[next];
  const fmt = (label: string, a: string, b?: string) => `${label.padEnd(5)}${a}${b && b !== a ? ` > ${b}` : ''}`;
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
  return lines.join('\n');
}
