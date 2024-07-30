# Problems with current implementation

- The anchor and query element are resolved at parse-time. This does not account
  for situations like `:focus` changing the `anchor-name` on an element.

- `anchor()` functions are parsed into a map of:
  `Selector => PropertyName => ParsedAnchor`. Anchors under the same selector
  and property are simply overwritten with the last one we saw. This does not
  account for situations like this:

  ```css
  @media screen {
    div {
      top: anchor(--anchor1 bottom);
    }
  }

  div {
    top: anchor(--anchor2 top);
  }
  ```

- Alternates between DOM reads / writes in a way that triggers lots of relayout
  / repaints.

- Rerunning when things change is difficult because the styles we added
  interfere with our own logic to determine where things should be

# Proposed design

## Phases

### 1. Fetch

**Run:** when `<style>`, `<link>` elements change or `style` attribute changes

**DOM:** read content of relevant style elements & attributes

Fetch all stylesheets and prepare them for preprocessing.

### 2. Preprocess

**Run:** when new styles are fetched

**DOM:** writes content of any changes style elements & attributes

Move all properties that aren't natively recognized (or potetnailly accept
values that aren't natively recognized) into custom properties. For example,
change:

```css
.anchor {
  anchor-name: --anchor;
  anchor-scope: all;
}

.positioned {
  position: absolute;
  left: anchor(--anchor right);
  width: anchor-size(--my-anchor-fallback width);
  height: 100px;
  position-try: --fallback;
}

@position-try --fallback {
  top: anchor(--anchor bottom);
}
```

into:

```css
.anchor {
  anchor-name: --anchor;
  --anchor-name: --anchor;
  anchor-scope: all;
  --anchor-scope: all;
}

.positioned {
  position: absolute;
  left: anchor(--anchor right);
  --left: anchor(--anchor right);
  width: anchor-size(--my-anchor-fallback width);
  --width: anchor-size(--my-anchor-fallback width);
  height: 100px;
  --height: 100px;
  position-try: --fallback;
  --position-try: --fallback;
}

/* No need to rewrite @position-try blocks */
@position-try --fallback {
  top: anchor(--anchor bottom);
}
```

Since we know which style sources changed, we can optimize and only rerun this
phase for styles that changed in some way.

### 3. Parse

**Run:** when new styles are preprocessed

**DOM:** should not perform any DOM reads / writes

Get a list of all selectors that _might_ have styles we need to polyfill. We
don't know for sure yet if we'll need to actually polyfill them, it depends on
the styles that win the cascade.

For `@position-try` blocks, we don't need to worry about the cascade, so we can
go ahead and fully parse them at this point.

We could maybe do some kind of optimization by tracking which candidates &
try blocks came from which style source, though not sure if it would be worth
the effort.

```ts
// Just record what might need polyfilling, but *don't* parse the anchor
// functions yet
const polyfillCandidates = {
  ['anchor-name']: ['.anchor'],
  ['anchor-scope']: ['.anchor'],
  ['left']: ['.positioned'],
  ['position-try']: ['.positioned'],
  ['width']: ['.positioned'],
  // Note: 'height' is not here, because `100px` will never need polyfill.
};

// For the @position-try blocks, parse most of it up front. However, we should
// not resolve the anchor element for any `anchor()` functions until the resolve
// phase.
const positionTryBlocks = {
  ['--fallback']: [
    /* current TryBlock format */
  ],
};
```

### 4. Resolve

**Run:** every animation frame

**DOM:** reads computed styles, should not perform any writes

Read the _actual_ values for our candidate elements from the DOM and use them to
create the complete anchor position data (similar to what today's parse phase
produces).

### 5. Position

**Run:** every animation frame (even if anchor position data has not changed,
since anchors still may have moved)

**DOM:** should batch bounding rect reads & style writes to the degree possible.

Recalculate the position of elements. Possibly could optimize based on whether
the anchor has the same bounds as previous run, but if there's a `position-try`
we may need to recalculate regardless.

Batch reads and writes by:

1. Determine batch of elements to be positioned (all elements that still need
   positioning and their anchor element either doesn't need positioning or has
   already been positioned)
2. Read all bounding rects needed to verify last round of attempted
   `position-try`
3. Read all bounding rects needed for this round
4. Write all styles for elements that can be positioned
5. Write the next `position-try` attempt for elements that are still being
   tested for the best position.
6. Repeat the process until all elements that need positioning have been
   positioned

## Coordination

- The styles we add in the preprocessing phase don't interfere with other parts
  of the polyfill or with future runs of the preprocessing phase. In the event
  that a sheet is preprocessed multiple times, we should probably clean up the
  old set of custom properties declarations, but that's the only real concern to
  be aware of.

- The styles we add in the positioning phase have the potential to interfere
  with other parts of the polyfill and with future runs of the positioning phase
  itself.

  - Potential interference with preprocess phase: The position phase will set
    properties like `left`, `width`, etc. If we're not careful those will be
    picked up in the preprocessing phase and transfered into our custom
    propertites (e.g. `--left`). To avoid this, any styles added by the position
    phase should be added in a style tag with a special attribute that signals
    to the preprocessing phase to ignore it. (e.g. `<style data-no-preprocess>`)
    All styles added this way should be added as `!important` to ensure they
    aren't defeated in the cascade. (We know we want these styles applied, since
    they're calculated based on computed style properties).

  - Potential interference with resolve phase: The resolve phase will read
    computed styles. If we're not careful it could wind up reading styles
    applied by the position phase instead of the intended style. We can avoid
    this by always reading the custom properties added in the preprocess phase,
    rather than the real property directly (e.g. `--width` instead of `width`).

  - Potential interference with future runs of the position phase: The position
    phase needs to read bounding rects, but it is possible that styles added by
    a previous run of the position phased have altered the bounding rect we're
    trying to read. To address this we could just remove all of the previously
    added styles before rerunning the position phase. We could try to be more
    intelligent about it by tracking which styles apply to which elements and
    only removing the styles that affect rects we need to read. I'm not sure if
    thats worth it though, it sounds difficult and as long as we're batching the
    reads / writes maybe removing them all isn't so bad.
