export type SpellKey = 'meteor' | 'freeze';

export interface SpellDef {
  key: SpellKey;
  name: string;
  description: string;
  icon: string;
  hotkey: string;
  /** Seconds to recharge. Cooldowns only tick while a wave is running. */
  cooldown: number;
}

export const SPELLS: Record<SpellKey, SpellDef> = {
  meteor: {
    key: 'meteor',
    name: 'Meteor',
    description: 'Click the map to drop a meteor on ground enemies. Pierces armour.',
    icon: 'icon_meteor',
    hotkey: 'Q',
    cooldown: 40,
  },
  freeze: {
    key: 'freeze',
    name: 'Freeze',
    description: 'Freezes every enemy for a few seconds. Bosses are only slowed.',
    icon: 'icon_freeze',
    hotkey: 'W',
    cooldown: 55,
  },
};

export const METEOR = {
  radius: 52,
  /** Seconds from casting to impact. */
  fallTime: 0.45,
  /** Damage grows with the wave so the meteor stays useful. */
  damage: (wave: number): number => 100 + 30 * wave,
};

export const FREEZE = { duration: 3 };

export const SPELL_ORDER: SpellKey[] = ['meteor', 'freeze'];
