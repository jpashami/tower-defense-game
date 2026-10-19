/** True on phones and tablets, where taps replace hovering, right-click and the keyboard. */
export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}
