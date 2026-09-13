/**
 * Inline image line-fit (batch #009 reworked, task-014 / ADR-0006).
 *
 * An image card (`.token.img-wrapper`, display: inline-block) in the editor
 * sizes via shrink-to-fit, whose "available" is the containing-block (section)
 * width — NOT the leftover inline space after a prefix. When its max-content
 * (driven by the raw `![alt](uri)` inside) exceeds that, the card wraps to its
 * own visual line, detaching it from a `- ` list marker.
 *
 * Rule (ADR-0006): when the image is the first content after a PURE MARKER
 * prefix on its line — list markers (`- ` `* ` `+ ` `1. `, incl. indent and
 * `- [ ]` checkboxes) and blockquote `> ` — the card is capped to the room
 * remaining after the prefix, so it stays on the marker line and the image
 * scales down proportionally (inner <img> max-width:100% + height:auto).
 * The cap is ALWAYS written in that case, otherwise the source text inside the
 * card would push it off the marker line; the image itself is never upscaled
 * or shrunk below its natural width ("不问上限不缩" holds at the <img> level).
 *
 * The marker-prefix room is measured from the prefix's own glyphs via a Range
 * over the section up to the wrapper — deterministic: a marker's width never
 * changes as the author types. With any ordinary text before the image on the
 * line, the prefix room is NOT used (f749889e did that and was reverted by
 * 3671d542 because the size jittered with unrelated prose) — the card falls
 * back to its own visual line, capped only by that line's full width.
 */

const MIN_FIT_EM = 4; // below this remaining room, fall back to wrap (full width)
const SLACK_EM = 0.4; // wrapper/img horizontal padding headroom

// A line prefix made only of list markers (incl. indent + checkbox) and
// blockquote markers: `  - [ ] `, `> `, `> 1. `, etc. Purely-whitespace
// prefixes match too, so PURE_MARKER_PRESENT additionally requires at least
// one real marker glyph.
const PURE_MARKER_LINE = /^(?:\s+|[-+*]\s|\d{1,9}\.\s|\[(?: |x|X)\]\s|>\s?)*$/;
const HAS_MARKER_GLYPH = /[-+*>]|\d+\.|\[[ xX]\]/;

const closestSection = elt => elt && elt.closest && elt.closest('.cledit-section');

/**
 * Remaining inline width (px) on the wrapper's current visual line, measured
 * from the wrapper's left edge to the section's content-box right edge.
 * Returns null when the wrapper is not yet laid out or the room is 0/negative.
 */
export function measureInlineRoom(wrapper) {
  const section = closestSection(wrapper);
  if (!section) {
    return null;
  }
  const sectionRect = section.getBoundingClientRect();
  const cs = getComputedStyle(section);
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const rightEdge = sectionRect.right - paddingRight;
  const wrapperRect = wrapper.getBoundingClientRect();
  const room = rightEdge - wrapperRect.left;
  if (room <= 0) {
    return null;
  }
  return room;
}

/**
 * If the wrapper is the first content after a pure-marker prefix on its
 * logical line, return the room (px) left after that prefix. Otherwise null.
 * The prefix is the text after the last '\n' before the wrapper inside its
 * section; its end position comes from the last client rect of a Range over
 * the preceding content — stable because it only involves marker glyphs.
 */
export function measureMarkerPrefixRoom(wrapper) {
  const section = closestSection(wrapper);
  if (!section || !wrapper.parentNode) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(section);
  range.setEndBefore(wrapper);
  const prefix = range.toString();
  const linePrefix = prefix.slice(prefix.lastIndexOf('\n') + 1);
  if (!linePrefix || !PURE_MARKER_LINE.test(linePrefix) || !HAS_MARKER_GLYPH.test(linePrefix)) {
    return null;
  }
  const rects = range.getClientRects();
  if (!rects.length) {
    return null;
  }
  const last = rects[rects.length - 1];
  const sectionRect = section.getBoundingClientRect();
  const cs = getComputedStyle(section);
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const rightEdge = sectionRect.right - paddingRight;
  const room = rightEdge - last.right;
  if (room <= 0) {
    return null;
  }
  return room;
}

/**
 * Marker-pinned card: always cap the wrapper to the remaining room after the
 * marker so the card (image + source text) stays on the marker line. The
 * image keeps its natural size while it fits the cap ("不问上限不缩"), and
 * only scales down proportionally when the cap is narrower (inner <img>
 * max-width:100% + height:auto).
 *
 * Anywhere else: cap ONLY by the wrapper's own visual line (measured from the
 * wrapper's left edge, never from preceding text), and write nothing at all
 * when the natural width already fits — the card then keeps its fixed,
 * natural size on its own line.
 *
 * Below MIN_FIT_EM of remaining room, both paths clear the cap and let the
 * card wrap. Returns true when an inline max-width actually changed.
 */
export function fitImgWrapper(wrapper) {
  const img = wrapper.querySelector('img');
  if (!img) {
    return false;
  }
  const section = closestSection(wrapper);
  if (!section) {
    return false;
  }
  const fs = parseFloat(getComputedStyle(section).fontSize) || 16;
  const minPx = MIN_FIT_EM * fs;
  const slackPx = (SLACK_EM * fs) + 2;
  const markerRoom = measureMarkerPrefixRoom(wrapper);
  const room = markerRoom != null ? markerRoom : measureInlineRoom(wrapper);
  if (room == null) {
    // Not enough info — let CSS max-width:100% drive it.
    if (wrapper.style.maxWidth) {
      wrapper.style.maxWidth = '';
      return true;
    }
    return false;
  }
  const usable = room - slackPx;
  if (usable < minPx) {
    // Too narrow to read — fall back to wrap / full container width.
    if (wrapper.style.maxWidth) {
      wrapper.style.maxWidth = '';
      return true;
    }
    return false;
  }
  if (markerRoom == null) {
    // Own-line card: keep FIXED natural size whenever it fits the line.
    const natural = img.naturalWidth || 0;
    if (natural && natural <= usable) {
      if (wrapper.style.maxWidth) {
        wrapper.style.maxWidth = '';
        return true;
      }
      return false;
    }
  }
  const target = `${Math.floor(usable)}px`;
  if (wrapper.style.maxWidth !== target) {
    wrapper.style.maxWidth = target;
    return true;
  }
  return false;
}

/**
 * Fit every `.img-wrapper` under rootElt. Returns true if any max-width
 * changed (caller may need to re-measure section dimensions).
 */
export function fitAllImgWrappers(rootElt) {
  const wrappers = rootElt.getElementsByClassName('img-wrapper');
  let changed = false;
  Array.prototype.forEach.call(wrappers, (wrapper) => {
    if (fitImgWrapper(wrapper)) {
      changed = true;
    }
  });
  return changed;
}

export default { measureInlineRoom, measureMarkerPrefixRoom, fitImgWrapper, fitAllImgWrappers };
