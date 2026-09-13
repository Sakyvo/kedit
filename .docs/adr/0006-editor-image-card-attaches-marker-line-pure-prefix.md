# Editor image cards attach to the marker line only for pure-marker prefixes

Status: accepted

An inline image in the editor renders as an image card (`.img-wrapper` =
rendered `<img>` + its raw `![alt](uri)` source text, `display: inline-block`).
When the card follows a line prefix, two desires conflict: the image should
stay on the same line as a `- ` list marker (readability), yet its size should
never depend on how much unrelated text precedes it (stability).

**Decision**: the card scales down (proportionally, `height:auto`) to the
remaining line width **only when the prefix contains nothing but markers** —
list markers (`- ` `* ` `+ ` `1. `, incl. indent and `- [ ]` checkboxes) and
blockquote `> `, plus whitespace. With any ordinary text before the image on
the line, the card keeps today's behavior (wraps to its own line, capped by
its own line's width). When the remaining room is narrower than 4em, fall back
to wrapping. When the image's natural width already fits, nothing is scaled
("不问上限不缩").

**Considered Options**

- *Any prefix pins the card inline (scale to whatever room is left)* — this was
  f749889e's Range-based behavior, reverted in 3671d542: the measured room
  coupled the image size to the end of preceding text, so same-line prose made
  images jitter in size while typing.
- *Card always on its own line (status quo)* — visually detaches images from
  their list marker, which reads as if the image belongs to the next line.

Pure-marker detection kills the coupling because a marker's width is stable
under typing, while still fixing the marker-detachment ambiguity.
