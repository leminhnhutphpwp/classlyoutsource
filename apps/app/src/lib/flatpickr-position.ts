/**
 * Reposition an open flatpickr calendar so it stays fully inside the viewport.
 *
 * Flatpickr decides "open below / above" while the calendar is still animating
 * in, so on short viewports it can end up hanging past the bottom edge. That is
 * especially bad inside a modal: FormModal locks `body { overflow: hidden }`,
 * so the overflowing part of the calendar is simply unreachable.
 *
 * This helper re-measures after the open animation and:
 * - flips the calendar to the side that has room (prefers below),
 * - clamps `top` / `left` to the viewport with a small margin,
 * - keeps the flatpickr arrow (`arrowTop`/`arrowBottom`) pointing at the input.
 *
 * @param instance A flatpickr instance (its `calendarContainer` must be open).
 */
export function keepFlatpickrInViewport(instance: {
  calendarContainer: HTMLElement | null;
  altInput?: HTMLElement | null;
  input?: HTMLElement | null;
}): void {
  const calendar = instance.calendarContainer;
  const positionElement = instance.altInput || instance.input;
  if (!calendar || !positionElement || typeof window === "undefined") return;

  const inputRect = positionElement.getBoundingClientRect();
  const width = calendar.offsetWidth || 308;
  const height = calendar.offsetHeight || 344;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;
  const gap = 2;

  const spaceBelow = viewportHeight - inputRect.bottom;
  const spaceAbove = inputRect.top;

  // Pick the side that fits; when neither fits, pick the one with more room.
  const belowTop = inputRect.bottom + gap;
  const aboveTop = inputRect.top - height - gap;
  let top: number;
  if (spaceBelow >= height + margin) {
    top = belowTop;
  } else if (spaceAbove >= height + margin) {
    top = aboveTop;
  } else {
    top = spaceBelow >= spaceAbove ? belowTop : aboveTop;
  }
  // Final clamp: never leave the calendar outside the viewport.
  top = Math.max(margin, Math.min(top, viewportHeight - height - margin));
  calendar.style.top = `${top}px`;

  // Horizontal: center on small screens, otherwise align to the input,
  // clamped to the viewport.
  let left: number;
  if (viewportWidth <= 640) {
    left = Math.max(margin, (viewportWidth - width) / 2);
  } else {
    left = Math.min(
      Math.max(margin, inputRect.left),
      viewportWidth - width - margin,
    );
  }
  calendar.style.left = `${left}px`;
  calendar.style.right = "auto";
  calendar.style.transform = "none";

  // Point the calendar arrow at the input (flatpickr keeps the old class when
  // we flip it ourselves).
  const opensAbove = top < inputRect.top;
  calendar.classList.toggle("arrowBottom", opensAbove);
  calendar.classList.toggle("arrowTop", !opensAbove);
}
