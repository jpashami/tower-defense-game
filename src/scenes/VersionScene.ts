import Phaser from 'phaser';
import { FONT, GAME_W } from '../config/constants';
import { loadDifficulty } from '../config/difficulty';
import { loadMapMode } from '../config/settings';
import { currentPlayer } from '../profile/players';
import { Button, type ButtonOptions } from '../ui/Button';
import { centreScene, fullScreenRect } from '../ui/layout';
import { copyText, pasteText, textBoxStyle } from '../ui/textBox';
import { versionHash } from '../version/compile';
import { EXAMPLE_VERSIONS } from '../version/examples';
import type { VersionData } from '../version/format';
import { shareLink } from '../version/link';
import { buildPrompt } from '../version/prompt';
import { activeContent, setActiveVersion } from '../version/registry';
import { activeVersionId, deleteVersion, listVersions, MAX_VERSIONS, saveVersion, setActiveVersionId } from '../version/store';
import { summarize } from '../version/summary';
import { checkVersion, parseVersionText, type CheckResult } from '../version/validate';

const CX = GAME_W / 2;
const IDEA_LENGTH = 600;

/** Example ideas a child can tap to fill the idea box. */
const IDEAS: { label: string; text: string }[] = [
  { label: 'SPOOKY GHOSTS', text: 'Spooky ghosts that stay invisible until a lantern tower lights them up. When you beat a ghost it splits into little wisps.' },
  { label: 'PIRATE RIVER', text: 'Pirates sail boats down a river while skeletons march over the bridges. Give us cannon towers and bomb traps on the road.' },
  { label: 'ROBOT ARMY', text: 'Robots with shields that attack our towers, and laser towers whose zaps jump between robots. A big map please.' },
  { label: 'CANDY LAND', text: 'A candy land with a chocolate river, gummy bears that split in two, and lollipop towers that make enemies sticky.' },
  { label: 'DINO DESERT', text: 'Dinosaurs stomping across a desert with sand and lava roads, flying pterodactyls, and a giant T-rex boss.' },
  { label: 'SNOW FORT', text: 'A frozen land with icy roads, yetis that heal each other, and snowball towers that freeze enemies.' },
];

type Source = 'paste' | 'link' | 'example' | 'saved';

export interface VersionSceneData {
  /** Open straight onto a version from a share link. */
  incoming?: CheckResult;
}

/**
 * "My versions": pick, share or delete saved versions, try the examples, and make a new
 * one with the family's own Claude chat (copy a prompt out, paste Claude's answer in).
 * Everything that comes back in goes through the checker before it is shown or played.
 */
export class VersionScene extends Phaser.Scene {
  private items: { destroy(): void }[] = [];
  private idea = '';
  private changeCurrent = true;
  private pasted = '';
  private armedDelete: string | null = null;

  constructor() {
    super('Versions');
  }

  create(data?: VersionSceneData): void {
    centreScene(this);
    fullScreenRect(this, 0x1a1c2c, 1);
    this.items = [];
    this.armedDelete = null;
    if (data?.incoming) this.showIncoming(data.incoming);
    else this.showList();
  }

  // ----- Building blocks -----

  private clear(): void {
    for (const o of this.items) o.destroy();
    this.items = [];
  }

  private text(x: number, y: number, str: string, size = 8, color = '#f4f4f4', wrap = 0): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center', wordWrap: wrap ? { width: wrap } : undefined })
      .setOrigin(0.5, 0)
      .setLineSpacing(6);
    this.items.push(t);
    return t;
  }

  private button(opts: ButtonOptions): Button {
    const b = new Button(this, opts);
    this.items.push(b);
    return b;
  }

  private box(x: number, y: number, w: number, h: number, size: number, tag: 'textarea' | 'input' = 'textarea'): HTMLTextAreaElement {
    const el = this.add.dom(x, y, tag, textBoxStyle(w, h, size, false));
    this.items.push(el);
    const node = el.node as HTMLTextAreaElement;
    node.spellcheck = false;
    return node;
  }

  /** A row of evenly spaced buttons along the bottom. */
  private bottomRow(buttons: Omit<ButtonOptions, 'x' | 'y' | 'w' | 'h'>[], y = 428): Button[] {
    const w = 150;
    const gap = 12;
    const left = CX - (buttons.length * w + (buttons.length - 1) * gap) / 2;
    return buttons.map((b, i) => this.button({ ...b, x: left + i * (w + gap), y, w, h: 32 }));
  }

  private back(): void {
    this.scene.start('Menu');
  }

  // ----- My versions -----

  private showList(): void {
    this.clear();
    const player = currentPlayer();
    this.text(CX, 18, 'MY VERSIONS', 16, '#ffcd75');
    this.text(CX, 44, `${player.name}: tap a version to pick it, then PLAY on the title screen.`, 8, '#94b0c2');
    const saved = listVersions();
    const active = activeVersionId();
    const rows: { id: string | null; name: string; data: VersionData | null }[] = [
      { id: null, name: 'CLASSIC GAME', data: null },
      ...saved.map((v) => ({ id: v.id, name: v.data.name, data: v.data })),
    ];
    rows.forEach((row, i) => {
      const y = 64 + i * 30;
      const isActive = row.id === active || (!row.id && !active);
      this.button({
        x: CX - 260,
        y,
        w: 350,
        h: 26,
        label: row.name,
        onClick: () => {
          setActiveVersionId(row.id);
          setActiveVersion(row.data);
          this.showList();
        },
      }).setActive(isActive);
      if (!row.data) return;
      const data = row.data;
      this.button({ x: CX + 98, y, w: 76, h: 26, label: 'SEE', variant: 'accent', onClick: () => this.showSummary({ ok: true, version: data, problems: [] }, 'saved') });
      const del = this.button({
        x: CX + 182,
        y,
        w: 78,
        h: 26,
        label: this.armedDelete === row.id ? 'SURE?' : 'DELETE',
        variant: 'danger',
        onClick: () => {
          if (this.armedDelete !== row.id) {
            this.armedDelete = row.id;
            this.showList();
            return;
          }
          deleteVersion(row.id!);
          if (activeContent().id === row.id) setActiveVersion(null);
          this.armedDelete = null;
          this.showList();
        },
      });
      del.setActive(this.armedDelete === row.id);
    });
    if (saved.length >= MAX_VERSIONS) this.text(CX, 398, `That's ${MAX_VERSIONS}, the most one player can keep. Delete one to save another.`, 8, '#ef7d57');
    this.bottomRow([
      { label: 'MAKE NEW', variant: 'primary', onClick: () => this.showMake() },
      { label: 'PASTE', variant: 'accent', onClick: () => this.showPaste() },
      { label: 'EXAMPLES', variant: 'accent', onClick: () => this.showExamples() },
      { label: 'BACK', onClick: () => this.back() },
    ]);
  }

  // ----- Examples -----

  private showExamples(): void {
    this.clear();
    this.text(CX, 18, 'EXAMPLES', 16, '#ffcd75');
    this.text(CX, 44, 'Versions made to show what the game can do. Try one!', 8, '#94b0c2');
    Object.values(EXAMPLE_VERSIONS).forEach((raw, i) => {
      const checked = checkVersion(raw);
      if (!checked.ok) return;
      const y = 76 + i * 92;
      this.button({ x: CX - 300, y, w: 600, h: 80, onClick: () => this.showSummary(checked, 'example') });
      this.text(CX, y + 12, checked.version.name, 16, '#73eff7');
      this.text(CX, y + 38, checked.version.about ?? '', 8, '#d0dae2', 560);
    });
    this.bottomRow([{ label: 'BACK', onClick: () => this.showList() }]);
  }

  // ----- Make a new version -----

  private showMake(): void {
    this.clear();
    const current = activeContent().version;
    this.text(CX, 14, 'MAKE MY VERSION', 16, '#ffcd75');
    this.text(CX, 38, 'Tell Claude your idea: new enemies, a new army of towers and road traps, and a new map.', 8, '#f4f4f4', 700);
    const area = this.box(CX, 104, 640, 90, 10);
    area.maxLength = IDEA_LENGTH;
    area.placeholder = 'Type your idea here, or tap an example below...';
    area.value = this.idea;
    area.addEventListener('input', () => (this.idea = area.value.slice(0, IDEA_LENGTH)));

    IDEAS.forEach((idea, i) => {
      this.button({
        x: CX - 300 + (i % 3) * 204,
        y: 158 + Math.floor(i / 3) * 32,
        w: 192,
        h: 26,
        label: idea.label,
        onClick: () => {
          this.idea = idea.text;
          area.value = idea.text;
        },
      });
    });

    if (current) {
      const toggle = this.button({
        x: CX - 150,
        y: 230,
        w: 300,
        h: 26,
        label: '',
        onClick: () => {
          this.changeCurrent = !this.changeCurrent;
          toggle.setLabel(this.changeCurrent ? `CHANGE ${current.name}` : 'START FRESH').setActive(this.changeCurrent);
        },
      });
      toggle.setLabel(this.changeCurrent ? `CHANGE ${current.name}` : 'START FRESH').setActive(this.changeCurrent);
    }

    const status = this.text(CX, 316, '1. Press ASK CLAUDE to copy a message.\n2. Paste it into Claude and send it.\n3. Copy Claude\'s whole answer and press PASTE FROM CLAUDE.', 8, '#94b0c2', 700);
    this.button({
      x: CX - 250,
      y: 268,
      w: 240,
      h: 36,
      label: '1. ASK CLAUDE',
      variant: 'accent',
      onClick: () => {
        const prompt = buildPrompt(this.idea, current && this.changeCurrent ? current : null);
        void copyText(prompt).then((ok) => {
          if (ok) status.setText('COPIED! Now paste it into a Claude chat and send it.\nWhen Claude answers, copy its whole answer and\npress PASTE FROM CLAUDE.').setColor('#a7f070');
          else this.showPrompt(prompt);
        });
      },
    });
    this.button({ x: CX + 10, y: 268, w: 240, h: 36, label: '2. PASTE FROM CLAUDE', variant: 'primary', onClick: () => this.showPaste() });
    this.text(CX, 384, 'Claude is for grown-ups: ask a parent to send this from their own Claude chat.', 8, '#ffcd75', 700);
    this.bottomRow([{ label: 'BACK', onClick: () => this.showList() }], 420);
  }

  /** When the clipboard is blocked: show the message so it can be copied by hand. */
  private showPrompt(prompt: string): void {
    this.clear();
    this.text(CX, 14, 'COPY THIS FOR CLAUDE', 16, '#ffcd75');
    this.text(CX, 38, 'Select all the text in the box, copy it, and paste it into Claude.', 8, '#f4f4f4', 700);
    const area = this.box(CX, 205, 700, 290, 8);
    area.readOnly = true;
    area.value = prompt;
    this.time.delayedCall(50, () => {
      area.focus();
      area.select();
    });
    this.bottomRow([
      { label: 'SELECT ALL', variant: 'accent', onClick: () => area.select() },
      { label: 'PASTE ANSWER', variant: 'primary', onClick: () => this.showPaste() },
      { label: 'BACK', onClick: () => this.showMake() },
    ]);
  }

  // ----- Paste Claude's answer -----

  private showPaste(): void {
    this.clear();
    this.text(CX, 14, 'PASTE FROM CLAUDE', 16, '#ffcd75');
    this.text(CX, 38, 'Copy Claude\'s whole answer, paste it in the box, then press READ IT.', 8, '#f4f4f4', 700);
    const area = this.box(CX, 190, 700, 250, 8);
    area.placeholder = 'Paste here...';
    area.value = this.pasted;
    area.addEventListener('input', () => (this.pasted = area.value));
    const msg = this.text(CX, 326, '', 8, '#ef7d57', 700);
    this.time.delayedCall(50, () => area.focus());
    this.bottomRow(
      [
        {
          label: 'PASTE',
          variant: 'accent',
          onClick: () => {
            void pasteText().then((t) => {
              if (t === null) msg.setText('Press and hold in the box (or Ctrl+V) to paste.').setColor('#ffcd75');
              else {
                area.value = t;
                this.pasted = t;
              }
            });
          },
        },
        {
          label: 'READ IT',
          variant: 'primary',
          onClick: () => {
            const result = parseVersionText(area.value);
            if (!result.ok) {
              msg.setText(result.error).setColor('#ef7d57');
              return;
            }
            this.showSummary(result, 'paste');
          },
        },
        { label: 'BACK', onClick: () => this.showMake() },
      ],
      390,
    );
  }

  // ----- Summary, play, save, share -----

  private showIncoming(result: CheckResult): void {
    if (result.ok) {
      this.showSummary(result, 'link');
      return;
    }
    this.clear();
    this.text(CX, 120, 'THAT LINK DIDN\'T WORK', 16, '#ef7d57');
    this.text(CX, 170, result.error, 8, '#f4f4f4', 600);
    this.bottomRow([{ label: 'OK', variant: 'primary', onClick: () => this.back() }], 260);
  }

  private showSummary(result: Extract<CheckResult, { ok: true }>, source: Source): void {
    this.clear();
    const v = result.version;
    const accent = v.theme?.accent ?? '#73eff7';
    if (source === 'link') this.text(CX, 8, 'SOMEONE SHARED A VERSION WITH YOU', 8, '#a7f070');
    this.text(CX, 22, v.name, 16, accent);
    if (v.author) this.text(CX, 46, `BY ${v.author}`, 8, '#94b0c2');
    const body = this.text(CX, 66, summarize(v).join('\n'), 8, '#f4f4f4', 700);
    body.setMaxLines(16);
    if (result.problems.length) {
      const shown = result.problems.slice(0, 3).map((p) => `- ${p}`);
      if (result.problems.length > 3) shown.push(`...and ${result.problems.length - 3} more.`);
      this.text(CX, 300, `The game left out ${result.problems.length} thing${result.problems.length === 1 ? '' : 's'} it couldn't use:\n${shown.join('\n')}`, 8, '#ef7d57', 700).setMaxLines(6);
    }
    const msg = this.text(CX, 404, source === 'link' ? 'Shared versions are CC BY-SA 4.0: free to play, change and share.' : '', 8, '#a7f070', 700);
    const play = () => {
      setActiveVersion(v);
      if (listVersions().some((s) => s.id === versionHash(v))) setActiveVersionId(versionHash(v));
      this.scene.start('Game', { difficulty: loadDifficulty(), map: loadMapMode() });
    };
    const save = () => {
      const r = saveVersion(v);
      if (r.ok) {
        setActiveVersionId(r.id);
        setActiveVersion(v);
        msg.setText(`SAVED for ${currentPlayer().name}! It's picked for PLAY now.`).setColor('#a7f070');
      } else {
        msg.setText(r.reason === 'full' ? `You already have ${MAX_VERSIONS}. Delete one first.` : "Couldn't save in this browser.").setColor('#ef7d57');
      }
    };
    const share = () => {
      void shareLink(v).then(async (link) => {
        const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
        if (nav.share && window.matchMedia?.('(pointer: coarse)').matches) {
          try {
            await nav.share({ title: `Pixel Tower Defence: ${v.name}`, url: link });
            return;
          } catch {
            // Fall back to copying.
          }
        }
        this.showLink(link, result, source);
      });
    };
    this.bottomRow([
      { label: 'PLAY', variant: 'primary', onClick: play },
      { label: source === 'saved' ? 'SAVE AGAIN' : 'SAVE', variant: 'accent', onClick: save },
      { label: 'SHARE LINK', variant: 'accent', onClick: share },
      { label: source === 'link' ? 'NO THANKS' : 'BACK', onClick: () => (source === 'link' ? this.back() : this.showList()) },
    ]);
  }

  private showLink(link: string, result: Extract<CheckResult, { ok: true }>, source: Source): void {
    this.clear();
    this.text(CX, 20, 'SHARE YOUR VERSION', 16, '#ffcd75');
    this.text(CX, 46, 'Send this link to a friend. It opens your version in their game.', 8, '#f4f4f4', 700);
    const area = this.box(CX, 150, 700, 150, 8);
    area.readOnly = true;
    area.value = link;
    const msg = this.text(CX, 250, '', 8, '#a7f070', 700);
    void copyText(link, area).then((ok) =>
      msg.setText(ok ? 'COPIED! Paste it into a message.' : 'Select the link and copy it.').setColor(ok ? '#a7f070' : '#ffcd75'),
    );
    this.text(CX, 300, `Long link? It holds the whole version (${link.length} letters).\nShared versions are CC BY-SA 4.0: anyone may play, change and share them, saying who made them.`, 8, '#94b0c2', 700);
    this.bottomRow([
      { label: 'COPY AGAIN', variant: 'accent', onClick: () => void copyText(link, area).then((ok) => msg.setText(ok ? 'COPIED!' : 'Select the link and copy it.')) },
      { label: 'BACK', onClick: () => this.showSummary(result, source) },
    ]);
  }
}
