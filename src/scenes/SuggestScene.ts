import Phaser from 'phaser';
import { FONT, GAME_W } from '../config/constants';
import { buildSuggestPrompt, FEATURE_FORM_URL, IDEA_LENGTH } from '../community/featureRequest';
import { Button, type ButtonOptions } from '../ui/Button';
import { centreScene, fullScreenRect } from '../ui/layout';
import { copyText, textBoxStyle } from '../ui/textBox';

const CX = GAME_W / 2;

/**
 * "Suggest a feature": copies a message that helps the family's own Claude chat turn a
 * rough idea into a clear request, then opens the feature form on GitHub. Offline, it
 * shows the link to use later instead.
 */
export class SuggestScene extends Phaser.Scene {
  private items: { destroy(): void }[] = [];
  private idea = '';

  constructor() {
    super('Suggest');
  }

  create(): void {
    centreScene(this);
    fullScreenRect(this, 0x1a1c2c, 1);
    this.items = [];
    this.showMain();
  }

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

  private showMain(): void {
    this.clear();
    this.text(CX, 14, 'SUGGEST A FEATURE', 16, '#ffcd75');
    this.text(
      CX,
      38,
      'Got an idea the game can\'t do yet? New enemies, towers and maps can be made right now with MY VERSION. This is for bigger ideas that need the game itself to change.',
      8,
      '#f4f4f4',
      700,
    );
    const area = this.box(CX, 120, 640, 90, 10);
    area.maxLength = IDEA_LENGTH;
    area.placeholder = 'Type your idea in your own words...';
    area.value = this.idea;
    area.addEventListener('input', () => (this.idea = area.value.slice(0, IDEA_LENGTH)));

    const status = this.text(
      CX,
      232,
      '1. Press ASK CLAUDE to copy a message, paste it into a Claude chat and send it.\n2. Press OPEN THE FORM and copy Claude\'s answers into the boxes.\nFamilies vote for ideas they like; the game\'s maker picks what to build.',
      8,
      '#94b0c2',
      700,
    );
    this.button({
      x: CX - 250,
      y: 300,
      w: 240,
      h: 36,
      label: '1. ASK CLAUDE',
      variant: 'accent',
      onClick: () => {
        const prompt = buildSuggestPrompt(this.idea);
        void copyText(prompt).then((ok) => {
          if (ok) status.setText('COPIED! Paste it into a Claude chat and send it.\nThen press OPEN THE FORM.').setColor('#a7f070');
          else this.showCopyBox('COPY THIS FOR CLAUDE', 'Select all the text in the box, copy it, and paste it into Claude.', prompt);
        });
      },
    });
    this.button({ x: CX + 10, y: 300, w: 240, h: 36, label: '2. OPEN THE FORM', variant: 'primary', onClick: () => this.openForm() });
    this.text(CX, 356, 'Claude and GitHub are for grown-ups: ask a parent to do these steps from their own accounts.', 8, '#ffcd75', 700);
    this.button({ x: CX - 75, y: 420, w: 150, h: 32, label: 'BACK', onClick: () => this.scene.start('Menu') });
  }

  private openForm(): void {
    if (navigator.onLine === false) {
      this.showCopyBox('NO INTERNET RIGHT NOW', 'The form is on GitHub, so it needs the internet. Copy this link and open it later.', FEATURE_FORM_URL);
      return;
    }
    window.open(FEATURE_FORM_URL, '_blank', 'noopener');
    this.showCopyBox('THE FORM IS OPENING', 'If no new page opened, copy this link into your browser.', FEATURE_FORM_URL);
  }

  /** Shows text to copy by hand: the Claude message when the clipboard is blocked, or the form's link. */
  private showCopyBox(heading: string, help: string, value: string): void {
    this.clear();
    this.text(CX, 14, heading, 16, '#ffcd75');
    this.text(CX, 38, help, 8, '#f4f4f4', 700);
    const short = value.length < 200;
    const area = this.box(CX, short ? 110 : 205, 700, short ? 70 : 290, 8);
    area.readOnly = true;
    area.value = value;
    this.time.delayedCall(50, () => {
      area.focus();
      area.select();
    });
    const msg = this.text(CX, 402, '', 8, '#a7f070', 700);
    const row: Omit<ButtonOptions, 'x' | 'y' | 'w' | 'h'>[] = [
      { label: 'COPY', variant: 'accent', onClick: () => void copyText(value, area).then((ok) => msg.setText(ok ? 'COPIED!' : 'Select the text and copy it by hand.')) },
      { label: 'BACK', onClick: () => this.showMain() },
    ];
    const left = CX - (row.length * 150 + (row.length - 1) * 12) / 2;
    row.forEach((b, i) => this.button({ ...b, x: left + i * 162, y: 428, w: 150, h: 32 }));
  }
}
