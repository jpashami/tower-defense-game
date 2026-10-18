/** Player choices on the title screen, remembered in the browser. */

export type MapMode = 'random' | 'classic';

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not critical.
  }
}

/** A new random map every game (default), or the original hand-made map. */
export const loadMapMode = (): MapMode => (load('pixel-td-map') === 'classic' ? 'classic' : 'random');
export const saveMapMode = (mode: MapMode): void => save('pixel-td-map', mode);

/** Whether random maps get a shortcut (default on). */
export const loadShortcutEnabled = (): boolean => load('pixel-td-shortcut') !== 'off';
export const saveShortcutEnabled = (on: boolean): void => save('pixel-td-shortcut', on ? 'on' : 'off');
