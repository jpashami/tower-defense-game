import Phaser from 'phaser';
import { FONT, GAME_W } from '../config/constants';
import {
  addPlayer,
  cleanPlayerName,
  currentPlayer,
  listPlayers,
  MAX_PLAYERS,
  PLAYER_NAME_LENGTH,
  removePlayer,
  renamePlayer,
  switchPlayer,
} from '../profile/players';
import { Button, type ButtonOptions } from '../ui/Button';
import { centreScene, fullScreenRect } from '../ui/layout';
import { textBoxStyle } from '../ui/textBox';
import { setActiveVersion, useSavedVersion } from '../version/registry';

const CX = GAME_W / 2;

/**
 * Who's playing? Each player keeps their own versions, Creator levels and settings.
 * Tap a name to switch; players can be added, renamed and removed (removing asks twice).
 */
export class PlayersScene extends Phaser.Scene {
  private items: { destroy(): void }[] = [];
  private armedRemove: string | null = null;

  constructor() {
    super('Players');
  }

  create(): void {
    centreScene(this);
    fullScreenRect(this, 0x1a1c2c, 1);
    this.items = [];
    this.armedRemove = null;
    this.showList();
  }

  private clear(): void {
    for (const o of this.items) o.destroy();
    this.items = [];
  }

  private text(x: number, y: number, str: string, size = 8, color = '#f4f4f4'): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5, 0);
    this.items.push(t);
    return t;
  }

  private button(opts: ButtonOptions): Button {
    const b = new Button(this, opts);
    this.items.push(b);
    return b;
  }

  private showList(): void {
    this.clear();
    this.text(CX, 30, "WHO'S PLAYING?", 16, '#ffcd75');
    this.text(CX, 58, 'Each player has their own versions, levels and settings.', 8, '#94b0c2');
    const me = currentPlayer();
    const players = listPlayers();
    players.forEach((p, i) => {
      const y = 90 + i * 40;
      const swatch = this.add.rectangle(CX - 232, y + 16, 20, 20, Phaser.Display.Color.HexStringToColor(p.color).color);
      this.items.push(swatch);
      this.button({ x: CX - 214, y, w: 240, h: 32, label: p.name, onClick: () => this.pick(p.id) }).setActive(p.id === me.id);
      this.button({ x: CX + 34, y, w: 96, h: 32, label: 'RENAME', variant: 'accent', onClick: () => this.showName(p.id, p.name) });
      if (players.length > 1) {
        this.button({
          x: CX + 138,
          y,
          w: 96,
          h: 32,
          label: this.armedRemove === p.id ? 'SURE?' : 'REMOVE',
          variant: 'danger',
          onClick: () => {
            if (this.armedRemove !== p.id) {
              this.armedRemove = p.id;
              this.showList();
              return;
            }
            removePlayer(p.id);
            this.armedRemove = null;
            useSavedVersion();
            this.showList();
          },
        }).setActive(this.armedRemove === p.id);
      }
    });
    if (this.armedRemove) this.text(CX, 340, 'Removing a player deletes everything they saved. Press SURE? to do it.', 8, '#ef7d57');
    const w = 160;
    if (players.length < MAX_PLAYERS) {
      this.button({ x: CX - w - 6, y: 380, w, h: 34, label: 'ADD PLAYER', variant: 'primary', onClick: () => this.showName(null, '') });
      this.button({ x: CX + 6, y: 380, w, h: 34, label: 'DONE', onClick: () => this.scene.start('Menu') });
    } else this.button({ x: CX - w / 2, y: 380, w, h: 34, label: 'DONE', onClick: () => this.scene.start('Menu') });
  }

  private pick(id: string): void {
    switchPlayer(id);
    useSavedVersion();
    this.scene.start('Menu');
  }

  /** Type a name for a new player (id null) or rename one. */
  private showName(id: string | null, name: string): void {
    this.clear();
    this.text(CX, 120, id ? 'RENAME PLAYER' : 'NEW PLAYER', 16, '#ffcd75');
    const el = this.add.dom(CX, 190, 'input', textBoxStyle(360, 48, 16));
    this.items.push(el);
    const input = el.node as HTMLInputElement;
    input.maxLength = PLAYER_NAME_LENGTH;
    input.value = name;
    input.spellcheck = false;
    input.addEventListener('input', () => (input.value = cleanPlayerName(input.value)));
    const done = () => {
      const clean = cleanPlayerName(input.value).trim();
      if (id) renamePlayer(id, clean);
      else {
        const p = addPlayer(clean);
        if (p) {
          switchPlayer(p.id);
          setActiveVersion(null);
        }
      }
      this.showList();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done();
    });
    this.time.delayedCall(50, () => {
      input.focus();
      input.select();
    });
    this.text(CX, 236, `Letters and numbers, up to ${PLAYER_NAME_LENGTH}.`, 8, '#94b0c2');
    this.button({ x: CX - 166, y: 270, w: 160, h: 34, label: 'OK', variant: 'primary', onClick: done });
    this.button({ x: CX + 6, y: 270, w: 160, h: 34, label: 'CANCEL', onClick: () => this.showList() });
  }
}
