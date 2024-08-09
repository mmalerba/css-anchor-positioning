import { Dom } from './dom.js';
import { preprocessSources } from './preprocess.js';
import { readCssSources, writeCssSources } from './source.js';

export async function run() {
  // Preprocess the CSS, shifting properties that need to be polyfilled into
  // custom properties.
  const sources = await readCssSources();
  const { selectorsByUuid, selectorsByProperty } = preprocessSources(sources);
  await writeCssSources(sources);

  // Prepare the DOM by creating placeholders for pseudo-elements.
  const dom = new Dom(selectorsByUuid);
  dom.createFakePseudoElements();
  const elementsBySelector = dom.getAllPolyfilledElements();

  // Parse anchors -- NOTE: I think it makes more sense to move this into
  //   pre-processing, so we don't reparse the same value from the same selector
  //   over and over on multiple elements.
  // Resolve anchors
  // Position elements
}
