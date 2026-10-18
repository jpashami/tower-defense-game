import Phaser from 'phaser';
import { DEPTH, FONT, GAME_H, GAME_W, MAP_H, MAP_W, PANEL_W, ROWS, TILE } from '../config/constants';
import { ENEMIES, type EnemyKey } from '../config/enemies';
import { defaultTuning } from '../config/level';
import { buildGrid, type DecorationKind } from '../config/map';
import { TOWERS, TOWER_ORDER } from '../config/towers';
import {
  blankLevel,
  canExtendPath,
  classicLevel,
  cleanName,
  cloneLevel,
  damageStep,
  ENEMY_ORDER,
  LIMITS,
  pathCorners,
  pathProblem,
  waveTotal,
  type CustomLevel,
  type WaveCounts,
} from '../editor/customLevel';
import { deleteLevel, isSaved, listLevels, loadDraft, MAX_SAVED, saveDraft, saveLevel } from '../editor/levelStore';
import { decodeLevel, encodeLevel } from '../editor/shareCode';
import { renderMap } from '../systems/MapRenderer';
import { Button, type ButtonOptions } from '../ui/Button';

type Tool = 'path' | 'tree' | 'rock' | 'erase';
interface Cell {
  col: number;
  row: number;
}

const X = MAP_W + 8;
const W = PANEL_W - 16;
const HALF = (W - 8) / 2;
const CX = GAME_W / 2;
const TOAST_DEPTH = 40;
const OVERLAY_DEPTH = 50;

/** Enemy colours for the wave chart; the brute's own plum is too dark on the panel. */
const CHART_COLORS: Record<EnemyKey, number> = { grunt: 0x38b764, runner: 0xef7d57, brute: 0xc27bc2 };

const TOOL_HINTS: Record<Tool, string> = {
  path: 'Click squares in a line from the left edge. The last one is the castle.',
  tree: 'Click grass to plant a tree. Click it again to take it away.',
  rock: 'Click grass to drop a rock. Click it again to take it away.',
  erase: 'Click a tree or rock to clear it. Click the path to cut it short.',
};

/**
 * The Creator: paint a path, place trees and rocks, set up waves and towers,
 * then play, save or share the level. Big buttons, no typing except the name.
 */
export class EditorScene extends Phaser.Scene {
  private level!: CustomLevel;
  private tool: Tool = 'path';
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private marks!: Phaser.GameObjects.Graphics;
  private hover: Cell | null = null;
  private dragMode: 'add' | 'remove' | null = null;
  private lastDragCell: Cell | null = null;

  private toolButtons = new Map<Tool, Button>();
  private nameBtn!: Button;
  private undoBtn!: Button;
  private clearBtn!: Button;
  private wavesBtn!: Button;
  private saveBtn!: Button;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private clearArmed = false;

  /** Everything belonging to the open full-screen panel, if any. */
  private overlay: { destroy(): void }[] = [];
  private overlayBuild: (() => void) | null = null;
  private selectedWave = 0;
  private pendingDelete: string | null = null;
  private levelsMessage = '';

  constructor() {
    super('Editor');
  }

  create(data?: { level?: CustomLevel }): void {
    this.level = cloneLevel(data?.level ?? loadDraft() ?? blankLevel());
    this.tool = 'path';
    this.mapObjects = [];
    this.hover = null;
    this.dragMode = null;
    this.toolButtons = new Map();
    this.overlay = [];
    this.overlayBuild = null;
    this.selectedWave = 0;
    this.clearArmed = false;

    this.buildPanel();
    this.marks = this.add.graphics().setDepth(DEPTH.ghost);
    this.toastText = this.add
      .text(MAP_W / 2, MAP_H - 44, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#f4f4f4',
        stroke: '#1a1c2c',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setLineSpacing(8)
      .setDepth(TOAST_DEPTH)
      .setAlpha(0);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      // Clicks on buttons (including one that just closed a panel) are not painting.
      if (over.length === 0) this.onPointerDown(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', () => (this.dragMode = null));

    this.redrawMap();
    this.refresh();

    if (import.meta.env.DEV) (window as unknown as { editorScene: EditorScene }).editorScene = this;
  }

  update(time: number): void {
    const g = this.marks;
    g.clear();
    if (this.overlayBuild) return;
    if (this.tool === 'path') {
      // Pulse the squares the path may grow into next.
      g.lineStyle(2, 0xffcd75, 0.55 + 0.35 * Math.sin(time / 180));
      for (const { col, row } of this.nextPathCells()) {
        g.strokeRect(col * TILE + 3, row * TILE + 3, TILE - 6, TILE - 6);
      }
    }
    if (this.hover) {
      g.lineStyle(2, 0xf4f4f4, 0.9).strokeRect(this.hover.col * TILE + 1, this.hover.row * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  // ---------- Side panel ----------

  private buildPanel(): void {
    const g = this.add.graphics();
    g.fillStyle(0x1a1c2c, 1).fillRect(MAP_W, 0, PANEL_W, GAME_H);
    g.fillStyle(0x333c57, 1).fillRect(MAP_W, 0, 2, GAME_H);
    g.fillStyle(0x262b3e, 1).fillRect(X, 224, W, 104);
    g.lineStyle(1, 0x333c57, 1).strokeRect(X + 0.5, 224.5, W - 1, 103);

    this.text(X + 2, 7, 'CREATOR', '#ffcd75');
    this.nameBtn = new Button(this, { x: X, y: 20, w: W, h: 24, label: '', onClick: () => this.openName() });

    const tools: { tool: Tool; label: string; icon?: string }[] = [
      { tool: 'path', label: 'PATH', icon: 'tile_path_0' },
      { tool: 'tree', label: 'TREE', icon: 'deco_tree' },
      { tool: 'rock', label: 'ROCK', icon: 'deco_rock' },
      { tool: 'erase', label: 'ERASE' },
    ];
    tools.forEach(({ tool, label, icon }, i) => {
      const x = X + (i % 2) * (HALF + 8);
      const y = 52 + Math.floor(i / 2) * 36;
      const b = new Button(this, { x, y, w: HALF, h: 30, label, onClick: () => this.setTool(tool) });
      if (icon) {
        this.add.image(x + 14, y + 15, icon).setScale(0.625);
        b.label?.setX(x + 44);
      }
      this.toolButtons.set(tool, b);
    });

    this.undoBtn = new Button(this, { x: X, y: 124, w: HALF, h: 26, label: 'UNDO', onClick: () => this.undoPath() });
    this.clearBtn = new Button(this, {
      x: X + HALF + 8,
      y: 124,
      w: HALF,
      h: 26,
      label: 'CLEAR',
      variant: 'danger',
      onClick: () => this.clearPath(),
    });
    this.wavesBtn = new Button(this, {
      x: X,
      y: 158,
      w: W,
      h: 26,
      label: '',
      variant: 'accent',
      onClick: () => this.openOverlay(() => this.buildWaves()),
    });
    new Button(this, {
      x: X,
      y: 190,
      w: W,
      h: 26,
      label: 'TOWERS',
      variant: 'accent',
      onClick: () => this.openOverlay(() => this.buildTowers()),
    });

    this.statusText = this.text(X + 6, 232, '');
    this.hintText = this.text(X + 6, 250, '', '#d0dae2').setLineSpacing(4).setWordWrapWidth(W - 12);

    this.saveBtn = new Button(this, { x: X, y: 334, w: HALF, h: 26, label: 'SAVE', onClick: () => this.save() });
    new Button(this, { x: X + HALF + 8, y: 334, w: HALF, h: 26, label: 'LEVELS', onClick: () => this.openLevels() });
    new Button(this, { x: X, y: 366, w: HALF, h: 26, label: 'SHARE', onClick: () => this.openShare() });
    new Button(this, { x: X + HALF + 8, y: 366, w: HALF, h: 26, label: 'NEW', onClick: () => this.openNew() });
    const play = new Button(this, { x: X, y: 400, w: W, h: 34, label: 'PLAY', variant: 'primary', onClick: () => this.play() });
    play.label?.setFontSize(16);
    new Button(this, { x: X, y: 442, w: W, h: 26, label: 'MAIN MENU', onClick: () => this.scene.start('Menu') });
  }

  /** Updates the panel after any change. */
  private refresh(): void {
    const L = this.level;
    for (const [tool, b] of this.toolButtons) b.setActive(tool === this.tool);
    this.nameBtn.setLabel(L.name || 'MY LEVEL');
    this.undoBtn.setEnabled(L.path.length > 0);
    this.clearBtn.setEnabled(L.path.length > 0).setLabel(this.clearArmed ? 'SURE?' : 'CLEAR');
    this.wavesBtn.setLabel(`WAVES: ${L.waves.length}`);
    const saved = isSaved(L);
    this.saveBtn.setLabel(saved ? 'SAVED' : 'SAVE').setActive(saved);

    const n = L.path.length;
    if (n === 0) this.statusText.setText('NO PATH YET').setColor('#ef7d57');
    else this.statusText.setText(`PATH: ${n} TILES`).setColor(n < LIMITS.minPath ? '#ef7d57' : '#a7f070');
    this.hintText.setText(TOOL_HINTS[this.tool]);
  }

  /** Called after every edit: redraw, refresh and keep the draft safe. */
  private changed(): void {
    this.redrawMap();
    this.refresh();
    saveDraft(this.level);
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.refresh();
  }

  private undoPath(): void {
    this.level.path.pop();
    this.changed();
  }

  private clearPath(): void {
    if (!this.clearArmed) {
      this.clearArmed = true;
      this.refresh();
      this.time.delayedCall(2500, () => {
        this.clearArmed = false;
        this.refresh();
      });
      return;
    }
    this.clearArmed = false;
    this.level.path = [];
    this.changed();
  }

  private save(): void {
    const result = saveLevel(this.level);
    if (result.ok) {
      this.level.id = result.level.id;
      saveDraft(this.level);
      this.refresh();
      this.toast('SAVED!', '#a7f070');
    } else if (result.reason === 'full') {
      this.levelsMessage = `All ${MAX_SAVED} spaces are full. Delete one to make room.`;
      this.openLevels();
    } else {
      this.toast("COULDN'T SAVE IN THIS BROWSER", '#ef7d57');
    }
  }

  private play(): void {
    const problem = pathProblem(this.level.path);
    if (problem) {
      this.setTool('path');
      this.toast(problem.toUpperCase(), '#ef7d57');
      return;
    }
    saveDraft(this.level);
    this.scene.start('Game', { custom: cloneLevel(this.level) });
  }

  // ---------- Painting the map ----------

  private redrawMap(): void {
    for (const o of this.mapObjects) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    const corners = pathCorners(this.level.path);
    this.mapObjects = renderMap(this, buildGrid(corners, this.level.decorations), corners, this.level.decorations);
  }

  private cellAt(p: Phaser.Input.Pointer): Cell | null {
    if (p.x < 0 || p.x >= MAP_W || p.y < 0 || p.y >= MAP_H) return null;
    return { col: Math.floor(p.x / TILE), row: Math.floor(p.y / TILE) };
  }

  private pathIndex(col: number, row: number): number {
    return this.level.path.findIndex(([c, r]) => c === col && r === row);
  }

  private decoIndex(col: number, row: number): number {
    return this.level.decorations.findIndex((d) => d.col === col && d.row === row);
  }

  private nextPathCells(): Cell[] {
    const path = this.level.path;
    if (path.length === 0) return Array.from({ length: ROWS }, (_, row) => ({ col: 0, row }));
    const [c, r] = path[path.length - 1];
    return [
      { col: c + 1, row: r },
      { col: c - 1, row: r },
      { col: c, row: r + 1 },
      { col: c, row: r - 1 },
    ].filter((n) => canExtendPath(path, n.col, n.row));
  }

  /** Adds a tile to the end of the path, clearing any tree or rock under it. */
  private extendPath(col: number, row: number): boolean {
    if (!canExtendPath(this.level.path, col, row)) return false;
    const d = this.decoIndex(col, row);
    if (d >= 0) this.level.decorations.splice(d, 1);
    this.level.path.push([col, row]);
    return true;
  }

  /** Dragging fast can skip squares; fill in a straight run back to the path's end. */
  private dragPathTo(col: number, row: number): boolean {
    const path = this.level.path;
    if (path.length === 0) return this.extendPath(col, row);
    const [lc, lr] = path[path.length - 1];
    if (lc !== col && lr !== row) return false;
    let changed = false;
    let [c, r] = [lc, lr];
    while (c !== col || r !== row) {
      c += Math.sign(col - c);
      r += Math.sign(row - r);
      if (!this.extendPath(c, r)) break;
      changed = true;
    }
    return changed;
  }

  private setDeco(col: number, row: number, kind: DecorationKind): void {
    const i = this.decoIndex(col, row);
    if (i >= 0) this.level.decorations[i].kind = kind;
    else this.level.decorations.push({ col, row, kind });
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.overlayBuild || p.rightButtonDown()) return;
    const cell = this.cellAt(p);
    if (!cell) return;
    const { col, row } = cell;
    const L = this.level;
    this.lastDragCell = cell;
    this.dragMode = null;

    const onPath = this.pathIndex(col, row);
    const deco = this.decoIndex(col, row);

    if (this.tool === 'path') {
      if (onPath >= 0) {
        // Clicking the end takes it back; clicking further along cuts the path there.
        L.path = L.path.slice(0, onPath === L.path.length - 1 ? onPath : onPath + 1);
        this.changed();
      } else if (this.extendPath(col, row)) {
        this.dragMode = 'add';
        this.changed();
      } else {
        this.toast(L.path.length === 0 ? 'START ON THE LEFT EDGE' : 'PICK A GLOWING SQUARE\nNEXT TO THE END', '#ffcd75');
      }
      return;
    }

    if (this.tool === 'erase') {
      if (deco >= 0) {
        L.decorations.splice(deco, 1);
        this.dragMode = 'remove';
        this.changed();
      } else if (onPath >= 0) {
        L.path = L.path.slice(0, onPath);
        this.changed();
      }
      return;
    }

    if (onPath >= 0) {
      this.toast('NOT ON THE PATH!', '#ef7d57');
      return;
    }
    if (deco >= 0 && L.decorations[deco].kind === this.tool) {
      L.decorations.splice(deco, 1);
      this.dragMode = 'remove';
    } else {
      this.setDeco(col, row, this.tool);
      this.dragMode = 'add';
    }
    this.changed();
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    const cell = this.overlayBuild ? null : this.cellAt(p);
    this.hover = cell;
    if (!cell || !p.isDown || !this.dragMode) return;
    if (this.lastDragCell && this.lastDragCell.col === cell.col && this.lastDragCell.row === cell.row) return;
    this.lastDragCell = cell;
    const { col, row } = cell;

    let changed = false;
    if (this.tool === 'path') {
      changed = this.dragPathTo(col, row);
    } else {
      const deco = this.decoIndex(col, row);
      if (this.dragMode === 'remove') {
        if (deco >= 0 && (this.tool === 'erase' || this.level.decorations[deco].kind === this.tool)) {
          this.level.decorations.splice(deco, 1);
          changed = true;
        }
      } else if (this.tool !== 'erase' && this.pathIndex(col, row) < 0) {
        this.setDeco(col, row, this.tool);
        changed = true;
      }
    }
    if (changed) this.changed();
  }

  private toast(message: string, color = '#f4f4f4'): void {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(message).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1800, duration: 400 });
  }

  private text(x: number, y: number, str: string, color = '#f4f4f4'): Phaser.GameObjects.Text {
    return this.add.text(x, y, str, { fontFamily: FONT, fontSize: '8px', color });
  }

  // ---------- Full-screen panels ----------

  private openOverlay(build: () => void): void {
    this.overlayBuild = build;
    this.hover = null;
    this.dragMode = null;
    this.renderOverlay();
  }

  /** Rebuilds the open panel from scratch; simplest way to show new numbers. */
  private renderOverlay(): void {
    this.overlay.forEach((o) => o.destroy());
    this.overlay = [];
    if (!this.overlayBuild) return;
    this.overlay.push(
      this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1a1c2c, 0.97).setOrigin(0).setDepth(OVERLAY_DEPTH).setInteractive(),
    );
    this.overlayBuild();
  }

  private closeOverlay(): void {
    this.overlayBuild = null;
    this.renderOverlay();
    this.refresh();
  }

  private oText(x: number, y: number, str: string, size = 8, color = '#f4f4f4'): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' })
      .setOrigin(0.5)
      .setLineSpacing(6)
      .setDepth(OVERLAY_DEPTH + 1);
    this.overlay.push(t);
    return t;
  }

  private oButton(opts: Omit<ButtonOptions, 'depth'>, big = false): Button {
    const b = new Button(this, { ...opts, depth: OVERLAY_DEPTH + 2 });
    if (big) b.label?.setFontSize(16);
    this.overlay.push(b);
    return b;
  }

  private oGraphics(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(OVERLAY_DEPTH + 1);
    this.overlay.push(g);
    return g;
  }

  private doneButton(label = 'DONE'): void {
    this.oButton({ x: CX - 80, y: 436, w: 160, h: 34, label, variant: 'primary', onClick: () => this.closeOverlay() }, true);
  }

  /** Label, big minus and plus buttons, and the value between them. 160 pixels wide. */
  private stepper(
    x: number,
    y: number,
    label: string,
    value: string,
    change: (dir: -1 | 1) => void,
    canDown: boolean,
    canUp: boolean,
  ): void {
    this.oText(x + 80, y, label, 8, '#94b0c2');
    const press = (dir: -1 | 1) => () => {
      change(dir);
      this.changed();
      this.renderOverlay();
    };
    this.oButton({ x, y: y + 12, w: 36, h: 36, label: '-', onClick: press(-1) }, true).setEnabled(canDown);
    this.oText(x + 80, y + 31, value, 16, '#ffcd75');
    this.oButton({ x: x + 124, y: y + 12, w: 36, h: 36, label: '+', onClick: press(1) }, true).setEnabled(canUp);
  }

  // ----- Waves, gold and lives -----

  private buildWaves(): void {
    const L = this.level;
    this.selectedWave = Phaser.Math.Clamp(this.selectedWave, 0, L.waves.length - 1);
    this.oText(CX, 22, 'WAVES AND GOLD', 16, '#ffcd75');

    this.stepper(
      60,
      46,
      'HOW MANY WAVES',
      String(L.waves.length),
      (dir) => {
        if (dir < 0) L.waves.pop();
        else L.waves.push(biggerWave(L.waves[L.waves.length - 1]));
      },
      L.waves.length > LIMITS.waves.min,
      L.waves.length < LIMITS.waves.max,
    );
    const money = LIMITS.money;
    this.stepper(
      320,
      46,
      'START GOLD',
      String(L.startMoney),
      (dir) => (L.startMoney = Phaser.Math.Clamp(L.startMoney + dir * money.step, money.min, money.max)),
      L.startMoney > money.min,
      L.startMoney < money.max,
    );
    const lives = LIMITS.lives;
    this.stepper(
      580,
      46,
      'LIVES',
      String(L.startLives),
      (dir) => (L.startLives = Phaser.Math.Clamp(L.startLives + dir * lives.step, lives.min, lives.max)),
      L.startLives > lives.min,
      L.startLives < lives.max,
    );

    // Bar chart of every wave, stacked by enemy type. Click a bar to edit that wave.
    this.oText(CX, 114, 'CLICK A BAR TO CHANGE THAT WAVE', 8, '#566c86');
    const slot = 36;
    const bottom = 222;
    const maxH = 88;
    const left = CX - (L.waves.length * slot) / 2;
    const tallest = Math.max(...L.waves.map(waveTotal), 1);
    const g = this.oGraphics();
    L.waves.forEach((w, i) => {
      const x = left + i * slot + 4;
      if (i === this.selectedWave) {
        g.fillStyle(0x333c57, 1).fillRect(x - 4, bottom - maxH - 6, slot, maxH + 24);
      }
      let y = bottom;
      for (const e of ENEMY_ORDER) {
        const h = Math.round((w[e] / tallest) * maxH);
        if (h <= 0) continue;
        g.fillStyle(CHART_COLORS[e], 1).fillRect(x, y - h, slot - 8, h);
        y -= h;
      }
      this.oText(x + (slot - 8) / 2, bottom + 10, String(i + 1), 8, i === this.selectedWave ? '#ffcd75' : '#94b0c2');
      const zone = this.add
        .zone(x - 4, bottom - maxH - 6, slot, maxH + 24)
        .setOrigin(0)
        .setDepth(OVERLAY_DEPTH + 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selectedWave = i;
          this.renderOverlay();
        });
      this.overlay.push(zone);
    });

    // The chosen wave, one row per enemy.
    const sel = this.selectedWave;
    const wave = L.waves[sel];
    this.oText(CX, 262, `WAVE ${sel + 1}`, 16, '#f4f4f4');
    const pick = (dir: number) => () => {
      this.selectedWave = Phaser.Math.Clamp(sel + dir, 0, L.waves.length - 1);
      this.renderOverlay();
    };
    this.oButton({ x: CX - 130, y: 248, w: 40, h: 28, label: '<', onClick: pick(-1) }, true).setEnabled(sel > 0);
    this.oButton({ x: CX + 90, y: 248, w: 40, h: 28, label: '>', onClick: pick(1) }, true).setEnabled(
      sel < L.waves.length - 1,
    );

    ENEMY_ORDER.forEach((e, i) => {
      const y = 290 + i * 46;
      const def = ENEMIES[e];
      g.fillStyle(0x262b3e, 1).fillRect(CX - 220, y, 440, 40);
      g.fillStyle(CHART_COLORS[e], 1).fillRect(CX - 220, y, 6, 40);
      const img = this.add.image(CX - 186, y + 20, `${def.texture}_0`).setScale(1.25).setDepth(OVERLAY_DEPTH + 1);
      this.overlay.push(img);
      this.oText(CX - 150, y + 21, def.name.toUpperCase(), 16).setOrigin(0, 0.5);
      const change = (dir: number) => () => {
        wave[e] = Phaser.Math.Clamp(wave[e] + dir, LIMITS.perEnemy.min, LIMITS.perEnemy.max);
        this.changed();
        this.renderOverlay();
      };
      this.oButton({ x: CX + 40, y: y + 2, w: 36, h: 36, label: '-', onClick: change(-1) }, true).setEnabled(
        wave[e] > 0 && waveTotal(wave) > 1,
      );
      this.oText(CX + 112, y + 21, String(wave[e]), 16, '#ffcd75');
      this.oButton({ x: CX + 148, y: y + 2, w: 36, h: 36, label: '+', onClick: change(1) }, true).setEnabled(
        wave[e] < LIMITS.perEnemy.max,
      );
    });

    this.doneButton();
  }

  // ----- Tower tuning -----

  private buildTowers(): void {
    const L = this.level;
    this.oText(CX, 22, 'TOWERS', 16, '#ffcd75');
    const g = this.oGraphics();
    TOWER_ORDER.forEach((key, i) => {
      const x = 28 + i * 252;
      const cx = x + 120;
      const def = TOWERS[key];
      const t = L.towers[key];
      const base = defaultTuning(key);
      g.fillStyle(0x262b3e, 1).fillRect(x, 46, 240, 334);

      for (const tex of [def.baseTexture, def.headTexture]) {
        const img = this.add.image(cx, 84, tex).setScale(2).setDepth(OVERLAY_DEPTH + 1);
        if (tex === def.headTexture && def.rotates) img.setRotation(-Math.PI / 4);
        this.overlay.push(img);
      }
      this.oText(cx, 128, def.name.toUpperCase(), 16);

      const sx = cx - 80;
      const dmg = damageStep(key);
      const { range, cost } = LIMITS;
      this.stepper(
        sx,
        148,
        'DAMAGE',
        String(t.damage),
        (dir) => (t.damage = Phaser.Math.Clamp(t.damage + dir * dmg, LIMITS.damage.min, LIMITS.damage.max)),
        t.damage > LIMITS.damage.min,
        t.damage < LIMITS.damage.max,
      );
      this.stepper(
        sx,
        208,
        'RANGE (SQUARES)',
        tiles(t.range),
        (dir) => (t.range = Phaser.Math.Clamp(t.range + dir * range.step, range.min, range.max)),
        t.range > range.min,
        t.range < range.max,
      );
      this.stepper(
        sx,
        268,
        'COST',
        String(t.cost),
        (dir) => (t.cost = Phaser.Math.Clamp(t.cost + dir * cost.step, cost.min, cost.max)),
        t.cost > cost.min,
        t.cost < cost.max,
      );
      const changedFromDefault = t.damage !== base.damage || t.range !== base.range || t.cost !== base.cost;
      this.oButton({
        x: sx,
        y: 340,
        w: 160,
        h: 28,
        label: 'RESET',
        onClick: () => {
          L.towers[key] = { ...base };
          this.changed();
          this.renderOverlay();
        },
      }).setEnabled(changedFromDefault);
    });
    this.oText(CX, 404, 'Upgrades get better by the same amount.', 8, '#94b0c2');
    this.doneButton();
  }

  // ----- Saved levels -----

  private openLevels(): void {
    this.pendingDelete = null;
    this.openOverlay(() => this.buildLevels());
  }

  private buildLevels(): void {
    this.oText(CX, 22, 'MY LEVELS', 16, '#ffcd75');
    this.oText(CX, 46, `Saved in this browser. Room for ${MAX_SAVED}.`, 8, '#94b0c2');
    if (this.levelsMessage) this.oText(CX, 64, this.levelsMessage, 8, '#ef7d57');

    const levels = listLevels();
    if (levels.length === 0) {
      this.oText(CX, 200, 'No saved levels yet.\nPress SAVE to keep your level here.', 8, '#f4f4f4');
    }
    const g = this.oGraphics();
    levels.forEach((l, i) => {
      const y = 82 + i * 54;
      const current = l.id === this.level.id;
      g.fillStyle(current ? 0x333c57 : 0x262b3e, 1).fillRect(60, y, 680, 46);
      this.oText(76, y + 15, l.name, 16, current ? '#ffcd75' : '#f4f4f4').setOrigin(0, 0.5);
      const info = `${l.waves.length} WAVES   ${l.path.length} PATH SQUARES${current ? '   (OPEN NOW)' : ''}`;
      this.oText(76, y + 34, info, 8, '#94b0c2').setOrigin(0, 0.5);
      this.oButton(
        {
          x: 480,
          y: y + 8,
          w: 120,
          h: 30,
          label: 'OPEN',
          variant: 'accent',
          onClick: () => {
            this.level = cloneLevel(l);
            this.selectedWave = 0;
            this.levelsMessage = '';
            this.closeOverlay();
            this.changed();
            this.toast(`OPENED ${l.name}`, '#a7f070');
          },
        },
        true,
      );
      const sure = this.pendingDelete === l.id;
      this.oButton(
        {
          x: 612,
          y: y + 8,
          w: 116,
          h: 30,
          label: sure ? 'SURE?' : 'DELETE',
          variant: 'danger',
          onClick: () => {
            if (!sure) {
              this.pendingDelete = l.id ?? null;
            } else {
              deleteLevel(l.id!);
              if (this.level.id === l.id) delete this.level.id;
              this.pendingDelete = null;
              this.levelsMessage = '';
              saveDraft(this.level);
            }
            this.renderOverlay();
          },
        },
        true,
      );
    });
    this.oButton(
      {
        x: CX - 80,
        y: 436,
        w: 160,
        h: 34,
        label: 'DONE',
        variant: 'primary',
        onClick: () => {
          this.levelsMessage = '';
          this.closeOverlay();
        },
      },
      true,
    );
  }

  // ----- Share codes -----

  private openShare(): void {
    this.openOverlay(() => this.buildShare());
  }

  private buildShare(): void {
    this.oText(CX, 22, 'SHARE', 16, '#ffcd75');
    this.oText(CX, 52, 'This code is your level. Send it to a friend!', 8, '#f4f4f4');

    const box = this.add.dom(CX, 124, 'textarea', textBoxStyle(640, 108, 12)).setDepth(OVERLAY_DEPTH + 3);
    const area = box.node as HTMLTextAreaElement;
    area.value = encodeLevel(this.level);
    area.spellcheck = false;
    this.overlay.push(box);

    const msg = this.oText(CX, 300, '', 8, '#a7f070');
    const say = (s: string, color: string) => msg.setText(s).setColor(color);

    this.oButton({
      x: CX - 170,
      y: 192,
      w: 160,
      h: 32,
      label: 'COPY CODE',
      variant: 'accent',
      onClick: () => {
        const code = encodeLevel(this.level);
        area.value = code;
        const fallback = () => {
          area.select();
          const ok = document.execCommand('copy');
          say(ok ? 'COPIED! Now paste it in a message.' : 'Select the code and copy it.', ok ? '#a7f070' : '#ffcd75');
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(() => say('COPIED! Now paste it in a message.', '#a7f070'), fallback);
        } else fallback();
      },
    });
    this.oButton({
      x: CX + 10,
      y: 192,
      w: 160,
      h: 32,
      label: 'LOAD CODE',
      variant: 'primary',
      onClick: () => {
        const result = decodeLevel(area.value);
        if (typeof result === 'string') {
          say(result, '#ef7d57');
          return;
        }
        this.level = result;
        this.selectedWave = 0;
        this.closeOverlay();
        this.changed();
        this.toast(`LOADED ${result.name}!\nPRESS SAVE TO KEEP IT.`, '#a7f070');
      },
    });
    this.oText(CX, 256, "Got a code from a friend? Paste it in the box\nabove, then press LOAD CODE.", 8, '#94b0c2');
    this.doneButton();
  }

  // ----- Name -----

  private openName(): void {
    this.openOverlay(() => this.buildName());
  }

  private buildName(): void {
    this.oText(CX, 120, 'NAME YOUR LEVEL', 16, '#ffcd75');
    const box = this.add.dom(CX, 184, 'input', textBoxStyle(440, 48, 16)).setDepth(OVERLAY_DEPTH + 3);
    const input = box.node as HTMLInputElement;
    input.maxLength = LIMITS.nameLength;
    input.value = this.level.name;
    input.spellcheck = false;
    input.addEventListener('input', () => (input.value = cleanName(input.value)));
    const done = () => {
      this.level.name = cleanName(input.value).trim() || 'MY LEVEL';
      this.closeOverlay();
      this.changed();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done();
    });
    this.overlay.push(box);
    this.time.delayedCall(50, () => {
      input.focus();
      input.select();
    });
    this.oText(CX, 236, `Letters and numbers, up to ${LIMITS.nameLength}.`, 8, '#94b0c2');
    this.oButton({ x: CX - 80, y: 270, w: 160, h: 34, label: 'OK', variant: 'primary', onClick: done }, true);
  }

  // ----- New level -----

  private openNew(): void {
    this.openOverlay(() => this.buildNew());
  }

  private buildNew(): void {
    this.oText(CX, 120, 'START A NEW LEVEL?', 16, '#ffcd75');
    if (!isSaved(this.level)) {
      this.oText(CX, 160, 'This level is not saved yet!\nPress SAVE first if you want to keep it.', 8, '#ef7d57');
    }
    const start = (level: CustomLevel) => () => {
      this.level = level;
      this.selectedWave = 0;
      this.tool = 'path';
      this.closeOverlay();
      this.changed();
    };
    this.oButton({ x: CX - 170, y: 210, w: 160, h: 34, label: 'EMPTY MAP', variant: 'primary', onClick: start(blankLevel()) });
    this.oButton({ x: CX + 10, y: 210, w: 160, h: 34, label: 'COPY CLASSIC', variant: 'accent', onClick: start(classicLevel()) });
    this.oButton({ x: CX - 80, y: 262, w: 160, h: 30, label: 'CANCEL', onClick: () => this.closeOverlay() });
  }
}

/** Next wave when adding one: the last wave plus a couple more enemies. */
function biggerWave(last: WaveCounts): WaveCounts {
  const next = { ...last };
  const max = LIMITS.perEnemy.max;
  if (next.grunt + 2 <= max) next.grunt += 2;
  else if (next.runner + 2 <= max) next.runner += 2;
  else next.brute = Math.min(max, next.brute + 1);
  return next;
}

const tiles = (px: number): string => String(Math.round((px / TILE) * 100) / 100);

function textBoxStyle(w: number, h: number, size: number): string {
  return [
    `width:${w}px`,
    `height:${h}px`,
    `font:${size}px "Press Start 2P", monospace`,
    `line-height:${size + 8}px`,
    'background:#262b3e',
    'color:#ffcd75',
    'border:2px solid #566c86',
    'padding:8px',
    'box-sizing:border-box',
    'resize:none',
    'outline:none',
    'text-transform:uppercase',
    'word-break:break-all',
  ].join(';');
}
