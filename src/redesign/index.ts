import { Dom } from './dom.js';
import { preprocessSources } from './preprocess.js';
import { readCssSources, writeCssSources } from './source.js';

export async function run() {
  // Preprocess the CSS, shifting properties that need to be polyfilled into
  // custom properties.
  const sources = await readCssSources();
  const { selectors, polyfilledPropertySelectors } = preprocessSources(sources);
  await writeCssSources(sources);

  // Prepare the DOM by creating placeholders for pseudo-elements.
  const dom = new Dom(selectors);
  dom.createFakePseudoElements();
  const elements = dom.getAllPolyfilledElements();

  // Parse anchors
  // Resolve anchors
  // Position elements
}
