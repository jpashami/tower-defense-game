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
import { isTouchDevice } from './ui/touch';
import { view, widthFor } from './ui/layout';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  // Wider than 800 on wide screens such as phones held sideways (see ui/layout.ts).
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
  const holder = document.getElementById('game')!;
  view.width = widthFor(holder.clientWidth, holder.clientHeight);
  const game = new Phaser.Game({ ...config, width: view.width });
  followScreenShape(game, holder);
  if (isTouchDevice() && !Capacitor.isNativePlatform()) goFullscreenOnFirstTap();
  // Dev server only: the balance-testing autoplayer (see src/dev/autoplay.ts).
  if (import.meta.env.DEV) void import('./dev/autoplay').then((m) => m.install(game));
}

void start();

/** When the phone turns or the window resizes, widen or narrow the canvas to match. */
function followScreenShape(game: Phaser.Game, holder: HTMLElement): void {
  let timer = 0;
  const check = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const w = widthFor(holder.clientWidth, holder.clientHeight);
      if (w === view.width) return;
      view.width = w;
      game.scale.setGameSize(w, GAME_H);
    }, 150);
  };
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
}

/**
 * In a phone browser the address bar eats a lot of a sideways screen. The first
 * tap asks for full screen (Android, Fire tablets; iPhones don't allow it, but
 * there the home-screen app has no bars anyway).
 */
function goFullscreenOnFirstTap(): void {
  const installed = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  const el = document.documentElement;
  if (installed || !el.requestFullscreen) return;
  const go = () => {
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => {});
  };
  window.addEventListener('pointerup', go, { once: true });
}

// Web build: the service worker caches the game so it installs to the home screen and plays offline.
if (import.meta.env.PROD && !Capacitor.isNativePlatform()) registerSW({ immediate: true });
