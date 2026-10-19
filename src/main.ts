import { Capacitor } from '@capacitor/core';
import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { GAME_H, GAME_W } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { EditorScene } from './scenes/EditorScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1a1c2c',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // The DOM container lets the Creator show real text boxes for level names and share codes.
  dom: { createContainer: true },
  scene: [BootScene, MenuScene, GameScene, UIScene, GameOverScene, EditorScene],
};

/** Wait briefly for the pixel font so text doesn't render in the fallback first. */
async function start(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.load('8px "Press Start 2P"'),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Font loading failed: fall back to monospace.
  }
  const game = new Phaser.Game(config);
  // Dev server only: the balance-testing autoplayer (see src/dev/autoplay.ts).
  if (import.meta.env.DEV) void import('./dev/autoplay').then((m) => m.install(game));
}

void start();

// Web build: the service worker caches the game so it installs to the home screen and plays offline.
if (import.meta.env.PROD && !Capacitor.isNativePlatform()) registerSW({ immediate: true });
