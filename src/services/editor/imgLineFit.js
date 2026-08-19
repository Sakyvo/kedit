/**
 * Inline image line-fit (batch #009).
 *
 * An image card (`.token.img-wrapper`, display: inline-block) in the editor
 * sizes via shrink-to-fit, whose "available" is the containing-block (section)
 * width — NOT the leftover inline space after a prefix. When its max-content
 * (driven by the raw `![alt](uri)` inside) exceeds that, it wraps to its own
 * visual line, detaching it from a `- ` list marker.
 *
 * The card is capped ONLY by the width left on its OWN visual line. That room
 * is measured as the wrapper's own `getBoundingClientRect().left` to the
 * section's content right edge — NOT from the section start via a Range, so
 * the size never depends on how much text sits on earlier visual lines.
 *
 * And when the image's natural width already fits that room, no max-width is
 * written at all: the image keeps its natural, fixed size ("不问上限不缩").
 * It only scales down proportionally (inner <img> max-width:100% + height:auto)
 * when it genuinely would not fit the line.
 */

const MIN_FIT_EM = 4; // below this remaining room, fall back to wrap (full width)
const SLACK_EM = 0.4; // wrapper/img horizontal padding headroom

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
 * Cap the wrapper's max-width so the card stays on its own visual line at a
 * stable size. Writes nothing when the image's natural width already fits the
 * room (keeps it FIXED — size never tied to preceding text). Only scales the
 * inner image down when it genuinely exceeds the line.
 * Returns true when an inline max-width actually changed.
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
  const room = measureInlineRoom(wrapper);
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
  // Check the image's natural size: if it already fits, keep it fixed.
  const natural = img.naturalWidth || 0;
  if (natural && natural <= usable) {
    if (wrapper.style.maxWidth) {
      wrapper.style.maxWidth = '';
      return true;
    }
    return false;
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

export default { measureInlineRoom, fitImgWrapper, fitAllImgWrappers };