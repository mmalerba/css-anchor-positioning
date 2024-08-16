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

- There are some edge cases where we can accidentally use inherited values for
  `anchor-name` & other properties, and cases where we rely on the value set in
  the selector rather than the cascaded value.
- Pseudo-elements are only handled for some properties, but not for others.

- Alternates between DOM reads / writes in a way that triggers lots of relayout
  / repaints.

- Rerunning when things change is difficult because the styles we added
  interfere with our own logic to determine where things should be

# Proposed design

The main idea is to keep most of the existing logic, but regoranize it to be
more deliberate about dividing it up according to the timng of when it will need
to be re-run, and trying to minimize read/write thrashing by batching together
reads and writes when possible.

In general the earlier phases need to be rerun less frequently than the later
phases, so its better to push work earlier if possible.

## Phases

### 1. Read styles

**Run:** When `<style>`, `<link>` elements change or `style` attribute changes

**DOM:** Read content of relevant style elements & attributes

Fetch all stylesheets and prepare them for preprocessing.

### 2. Preprocess

**Run:** When new styles are read

**DOM:** Writes content of any changes style elements & attributes

Copy all properties that aren't natively recognized (or potetnailly accept
values that aren't natively recognized) into custom properties. Also attach
metadata that we need for the rest of the polyfill. Metadata will be added by
appending a delimiter string followed by key/value pairs to the value. This
allows the metadata to follow the value through the cascade, and later be
extracted from the computed value.

The metdata we attach will include:

- selector: uuid - Links to the selector that set the value, allows us to verify
  that the value was indeed set direclty on the element, not inherited.
  Theoretically we wouldn't need this if we could use `@property` to disable
  inheritance on our custom properties, but this feature doesn't have sufficient
  browser support.
- parsed: uuid - Links to the pre-parsed value object (for properties with
  `anchor()` functions). This allows us to parse the value once in situations
  like `* {left: anchor(top)}` instead of re-parsing for every element, while
  still relying on the computed value to handle the cascade for us.
- dynamic: boolean - indicates that the value is dynamic (contains `var()`
  expressions). This allows us to reparse / revalidate the value per-element.

For example, we would change:

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
  --anchor-name: --anchor ⚓ selector⚓uuid1;
  anchor-scope: all;
  --anchor-scope: all ⚓ selector⚓uuid2;
}

.positioned {
  position: absolute;
  left: anchor(--anchor right);
  --left: anchor(--anchor right) ⚓ selector⚓uuid3 parsed⚓uuid4;
  width: anchor-size(--my-anchor-fallback width);
  --width: anchor-size(--my-anchor-fallback width) ⚓ selector⚓uuid5
    parsed⚓uuid6;
  height: 100px;
  --height: 100px ⚓ selector⚓uuid7;
  position-try: --fallback;
  --position-try: --fallback ⚓ selector⚓uuid8;
}

/* No need to rewrite @position-try blocks */
@position-try --fallback {
  top: anchor(--anchor bottom);
}
```

In addition to updating the CSS, we will create maps of all the selectors and
parsed anchor functions by we created to allow them to be looked up by uuid
elsewhere in the polyfill.

### 3. Prepare DOM

**Run:** When DOM nodes are added or when new styles are read

**DOM:** Need to read computed styles & write new elements and styles to the
DOM. This should be bartched, read _all_ the things first, then write _all_
the things.

Prepare the DOM for the rest of our polyfill checking our selectors to see if
they target `::before` or `::after` pseudo elements. For any that do, replace
them with a fake pseudo-element and hide the real pseudo element.

As part of this phase we'll create a dom helper object that allows the rest of
the polyfill to work with the DOM, accounting for the fact that we want to read
property values out of our copied custom properties and allowing us to work with
real elements and fake pseudo elements in a consistent manner.

### 4. Resolve

**Run:** Every animation frame

**DOM:** Reads computed styles, should not perform any writes

Read all of the polyfilled properties from the dom and exctract the metadata.

- Use the `selector` metadata to ensure that the selector it references actually
  selects the element we read it from (this allows us to avoid accidental
  inheritance of the value).
- Use the `parsed` metadata to look up any values that may have been previously
  parsed, allowing us to avoid duplicate work.
- Use the `dynamic` metadata to know when we need to reparse or revalidate the
  original value.

Based on the values we read for all of the properties, run the algorith to find
anchors for each of the anchor functions, and add the resolved anchor elements
to the function data.

### 5. Position

**Run:** Every animation frame

**DOM:** Should batch bounding rect reads & style writes to the degree possible.

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

We need to be careful that the styles we add here don't get picked up by the
rest of the polyfill causing it to feedback into itself. We can accomplish this
by adding all of the new styles in a new `<style>` tag at the end of the body.
The element will be marked with a class that the preprocessing phase knows to
ignore. Prior to rerunning the positioning phase this element can be removed so
it doesn't interfere with the next round of positioning.

# Current implementation state

- Proved out most aspects of phase 1-4, not started on phase 5
- Tests for phases 1-3
- Have not explored trying to re-run phases and making sure they don't interfere
  with each other
- Have not explored scheduling of when phases rerun
- `@position-try` not handled at all yet
