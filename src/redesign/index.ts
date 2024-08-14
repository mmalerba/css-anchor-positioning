import { Dom } from './dom.js';
import { preprocessSources } from './preprocess.js';
import { resolveAnchorProperties } from './resolve.js';
import { readCssSources, writeCssSources } from './source.js';

export async function run() {
  // Preprocess the CSS, copying properties that need to be polyfilled into
  // custom properties.
  const sources = await readCssSources();
  const { selectorsByUuid, selectorsByProperty, anchorValuesByUuid } =
    preprocessSources(sources);
  await writeCssSources(sources);

  // Prepare the DOM by creating placeholders for pseudo-elements.
  const dom = new Dom(selectorsByUuid);
  dom.createFakePseudoElements();

  // Resolve anchor data for all elements.
  const resolved = resolveAnchorProperties(
    dom,
    selectorsByProperty,
    anchorValuesByUuid,
  );

  // Position elements
}
