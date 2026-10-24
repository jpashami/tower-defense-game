import { Capacitor } from '@capacitor/core';
import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { GAME_H, GAME_W } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { EditorScene } from './scenes/EditorScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayersScene } from './scenes/PlayersScene';
import { SuggestScene } from './scenes/SuggestScene';
import { UIScene } from './scenes/UIScene';
import { VersionScene } from './scenes/VersionScene';
import { initPlayers } from './profile/players';
import { isTouchDevice } from './ui/touch';
import { view, widthFor } from './ui/layout';
import { readVersionFromAddress } from './version/incoming';
import { setActiveVersion } from './version/registry';
import { loadActiveVersion } from './version/store';

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
  scene: [BootScene, MenuScene, GameScene, UIScene, GameOverScene, EditorScene, VersionScene, PlayersScene, SuggestScene],
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
  // Players and their chosen version, before any scene reads them.
  initPlayers();
  setActiveVersion(loadActiveVersion()?.data ?? null);
  // A shared version in the address (#v=...) is offered on the title screen.
  void readVersionFromAddress();
  window.addEventListener('hashchange', () => void readVersionFromAddress());
  const holder = document.getElementById('game')!;
  view.width = widthFor(holder.clientWidth, holder.clientHeight);
  const game = new Phaser.Game({ ...config, width: view.width });
  followScreenShape(game, holder);
  if (isTouchDevice() && !Capacitor.isNativePlatform()) goFullscreenOnFirstTap();
  // Dev server only: the balance-testing autoplayer (see src/dev/autoplay.ts).
  if (import.meta.env.DEV) void import('./dev/autoplay').then((m) => m.install(game));
}

void start();

/**
 * When the phone turns or the window resizes, widen or narrow the canvas to match.
 * A ResizeObserver on the game's container catches every change, including rotation,
 * which the window "resize" event does not always report. Phaser is told to re-fit
 * every time, because its own fit can be left at the old orientation's size.
 */
function followScreenShape(game: Phaser.Game, holder: HTMLElement): void {
  let timer = 0;
  let fittedTo = '';
  const refit = () => {
    const size = `${holder.clientWidth}x${holder.clientHeight}`;
    if (holder.clientWidth === 0 || holder.clientHeight === 0) return;
    fittedTo = size;
    const w = widthFor(holder.clientWidth, holder.clientHeight);
    if (w !== view.width) {
      view.width = w;
      game.scale.setGameSize(w, GAME_H);
    }
    game.scale.refresh();
  };
  // Wait for a rotation to settle before measuring.
  const soon = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refit, 150);
  };
  if ('ResizeObserver' in window) new ResizeObserver(soon).observe(holder);
  window.addEventListener('resize', soon);
  window.addEventListener('orientationchange', soon);
  screen.orientation?.addEventListener?.('change', soon);
  // Safety net: some browsers report a rotation late or only half way, so check once a
  // second and re-fit if the screen is no longer the size the game was fitted to.
  window.setInterval(() => {
    if (`${holder.clientWidth}x${holder.clientHeight}` !== fittedTo) refit();
  }, 1000);
  refit();
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
