/**
 * Real HTML text boxes (Phaser DOM elements) for typing and pasting, plus copy and
 * paste helpers. Text only ever goes in and out through `.value`, never as HTML.
 */

/** Inline style for a pixel-font text box. */
export function textBoxStyle(w: number, h: number, size: number, upper = true): string {
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
    upper ? 'text-transform:uppercase' : '',
    'word-break:break-word',
  ]
    .filter(Boolean)
    .join(';');
}

/**
 * Copies text to the clipboard. Falls back to selecting it in a text box and the old
 * copy command; resolves false if the player has to copy it by hand.
 */
export async function copyText(text: string, area?: HTMLTextAreaElement | HTMLInputElement): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the old way.
  }
  if (!area) return false;
  area.value = text;
  area.focus();
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/** Reads the clipboard if the browser allows it; null means the player should paste by hand. */
export async function pasteText(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText && window.isSecureContext) return await navigator.clipboard.readText();
  } catch {
    // Permission refused.
  }
  return null;
}
