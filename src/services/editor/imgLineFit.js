/**
 * Inline image line-fit (batch #009).
 *
 * In the editor, an image card (`.token.img-wrapper`, display: inline-block)
 * sizes to min(natural image width, full section width). After a list marker
 * like `- ` it therefore rarely fits the remaining inline room and wraps to its
 * own line, making the image look detached from the list item.
 *
 * CSS alone cannot constrain the card to "rest-of-line" width (a percentage
 * max-width resolves against the containing block, not the leftover inline
 * space), so we measure the prefix width with a Range and cap the <img>
 * max-width in px. height:auto (already in markdownHighlighting.scss) keeps
 * the aspect ratio — the image scales down in proportion.
 */

const MIN_FIT_EM = 4; // below this remaining room, fall back to wrap (full width)
const SLACK_EM = 0.4; // img + wrapper horizontal padding/border headroom

const closestSection = elt => elt && elt.closest && elt.closest('.cledit-section');

/**
 * Remaining inline width (px) on the wrapper's visual line, measured from the
 * end of the preceding content to the section's content-box right edge.
 * Returns null when there is no preceding content on the line (image at line
 * start) — CSS max-width:100% handles that case.
 */
export function measureInlineRoom(wrapper) {
  const section = closestSection(wrapper);
  if (!section || !wrapper.parentNode) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(section);
  range.setEndBefore(wrapper);
  const rects = range.getClientRects();
  if (!rects.length) {
    return null;
  }
  const last = rects[rects.length - 1];
  const sectionRect = section.getBoundingClientRect();
  const cs = getComputedStyle(section);
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const rightEdge = sectionRect.right - paddingRight;
  return rightEdge - last.right;
}

/**
 * Cap the wrapper's <img> max-width so the card stays on the same line as its
 * prefix (e.g. a `- ` list marker), scaling the image down proportionally.
 * Falls back (clears the inline max-width) when the room is too narrow.
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
    // Image at line start: let CSS max-width:100% drive it.
    if (img.style.maxWidth) {
      img.style.maxWidth = '';
      return true;
    }
    return false;
  }
  const usable = room - slackPx;
  if (usable < minPx) {
    // Too narrow to read — fall back to wrap / full container width.
    if (img.style.maxWidth) {
      img.style.maxWidth = '';
      return true;
    }
    return false;
  }
  const target = `${Math.floor(usable)}px`;
  if (img.style.maxWidth !== target) {
    img.style.maxWidth = target;
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
