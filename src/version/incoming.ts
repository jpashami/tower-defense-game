import { decodeVersionHash, hasVersionHash } from './link';
import type { CheckResult } from './validate';

/**
 * A version that arrived in the page address (#v=...). It is read once, the address
 * is cleaned so a reload doesn't ask again, and the title screen offers it to the player.
 */
let pending: CheckResult | null = null;
let listener: ((r: CheckResult) => void) | null = null;

/** Reads a version from the address, if there is one. */
export async function readVersionFromAddress(): Promise<void> {
  const hash = location.hash;
  if (!hasVersionHash(hash)) return;
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    // Not critical.
  }
  const result = await decodeVersionHash(hash);
  if (listener) listener(result);
  else pending = result;
}

/** Takes the version waiting to be offered, if any. */
export function takeIncoming(): CheckResult | null {
  const r = pending;
  pending = null;
  return r;
}

/** Called when a version arrives while the game is already open. */
export function onIncoming(fn: ((r: CheckResult) => void) | null): void {
  listener = fn;
}
