/** Player choices on the title screen, remembered for each player. */
import { playerGet as load, playerSet as save } from '../profile/players';

export type MapMode = 'random' | 'classic';

/** A new random map every game (default), or the original hand-made map. */
export const loadMapMode = (): MapMode => (load('map') === 'classic' ? 'classic' : 'random');
export const saveMapMode = (mode: MapMode): void => void save('map', mode);

/** Whether random maps get a shortcut (default on). */
export const loadShortcutEnabled = (): boolean => load('shortcut') !== 'off';
export const saveShortcutEnabled = (on: boolean): void => void save('shortcut', on ? 'on' : 'off');
