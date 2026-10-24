import type { VersionData } from './format';
import { checkVersion, type CheckResult } from './validate';

/**
 * Share links carry a whole version after the "#" of the game's address:
 *   https://.../tower-defense-game/#v=1.<base64url of deflate-compressed JSON>
 * Browsers never send the part after "#" to the web server, so a version stays
 * between the people who share it, and links work offline in the installed game.
 * "#v=0." is the same without compression, for browsers that can't compress.
 * Opening a link only reads data: it goes through the same checks as a paste.
 */

/** Hard stops so a hostile link can't make the game chew on huge data. */
const MAX_HASH = 120_000;
const MAX_JSON = 200_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const canCompress = (): boolean => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflates, giving up (null) as soon as the output passes `limit` bytes. */
async function inflate(bytes: Uint8Array, limit: number): Promise<Uint8Array | null> {
  try {
    const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    const out = new Uint8Array(size);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  } catch {
    return null;
  }
}

/** The "#v=..." part of a share link for a version. */
export async function encodeVersionHash(v: VersionData): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(v));
  if (canCompress()) return `#v=1.${toBase64Url(await deflate(bytes))}`;
  return `#v=0.${toBase64Url(bytes)}`;
}

/** A full link to this game with the version in it. */
export async function shareLink(v: VersionData, base = location.href): Promise<string> {
  return base.split('#')[0] + (await encodeVersionHash(v));
}

/** Whether an address's "#" part holds a version. */
export const hasVersionHash = (hash: string): boolean => /^#?v=[01]\./.test(hash);

/** Reads a version from a link's "#" part, with all the usual checks. */
export async function decodeVersionHash(hash: string): Promise<CheckResult> {
  const bad = (error: string): CheckResult => ({ ok: false, error, problems: [] });
  const m = /^#?v=([01])\.([A-Za-z0-9_-]+)$/.exec(hash.trim());
  if (!m) return bad('That link has no version in it.');
  if (m[2].length > MAX_HASH) return bad('That link is too long to be a version.');
  const raw = fromBase64Url(m[2]);
  if (!raw) return bad('That link is broken. Ask for it to be sent again.');
  let bytes: Uint8Array | null = raw;
  if (m[1] === '1') {
    if (!canCompress()) return bad('This browser is too old to open version links.');
    bytes = await inflate(raw, MAX_JSON);
    if (!bytes) return bad('That link is broken or too big.');
  } else if (raw.length > MAX_JSON) return bad('That link is too big.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return bad('That link is broken. Ask for it to be sent again.');
  }
  return checkVersion(parsed);
}
