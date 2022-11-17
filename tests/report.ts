import fs from 'fs';

import type { BrowserDefinition, ResultData } from './wpt.js';

export interface VersionResult {
  name: string;
  summary: [number, number];
}
export interface TestPathMap {
  [key: string]: VersionResult[];
}

const localDomain = 'http://web-platform.test:8000/';

function gradientBar(active: number, total: number): string {
  const stop = `${((active / total) * 100).toFixed(0)}%`;
  return `style="background-image: linear-gradient(to right, darkgreen ${stop}, maroon ${stop})"`;
}

export default function writeReport(
  results: BrowserDefinition[],
  name?: string,
) {
  const wptRepo: string = process.env.WPT_REPO || 'web-platform-tests/wpt';
  const wptBranch: string = process.env.WPT_BRANCH || 'master';
  const commitUrl: string | undefined = process.env.COMMIT_URL;

  const timeStamp = new Date().toISOString();
  const testResultsFolder = 'test-results';
  const fileName = name || timeStamp.replace(':', '-');
  if (!fs.existsSync(testResultsFolder)) fs.mkdirSync(testResultsFolder);

  // Save the raw JSON data to debug / process further
  fs.writeFileSync(
    `${testResultsFolder}/${fileName}.json`,
    JSON.stringify(results, null, 2),
  );

  // Create an object mapping each test path with the results for all versions
  const byPath: TestPathMap = {};
  results.forEach((browser) => {
    browser.versions.forEach((version) => {
      const data = version.data as ResultData;
      data.results?.forEach(([longPath, result]) => {
        const path = longPath.replace(localDomain, '');
        const passed = result.tests.reduce(
          (total, test) => total + (test.status ? 0 : 1),
          0,
        );
        const total = result.tests.length;
        const data: VersionResult = {
          name: `${browser.name} ${version.name}`,
          summary: [passed, total],
        };
        byPath[path] ? byPath[path].push(data) : (byPath[path] = [data]);
      });
    });
  });

  // Render the HTML report
  // Each test gets a row, and the columns are the browser versions
  const tableHtml = `
  <style>
    td {border: 1px solid}
    .test-name {display: flex; justify-content: space-between; gap: 1em}
    .test-bar {color: white; background-color: maroon}
  </style>
  Generated at: ${timeStamp}
  ${
    commitUrl
      ? `<br><a target="_blank" href="${commitUrl}">Source commit</a>`
      : ''
  }
  <table>
    <thead>
      <tr>
        <th>Test</th>
        ${results
          .map((browser) =>
            browser.versions
              .map((version) => `<th>${browser.name}<br>${version.name}</th>`)
              .join(''),
          )
          .join('')}
      </tr>
    </thead>
    <tbody>
        ${Object.keys(byPath)
          .map(
            (testPath) =>
              `<tr>
                <td class="test-name">
                  <a target="_blank" href="https://github.com/${wptRepo}/blob/${wptBranch}/${testPath}">
                    ${testPath}
                  </a>
                  <span>
                    <a target="_blank" href="https://wpt.live/${testPath}" title="Open in wpt.live">🌐</a>
                    <a target="_blank" href="http://${localDomain}${testPath}" title="Open locally">🏠</a>
                  </span>
                </td>
                ${byPath[testPath]
                  .map(
                    ({ summary: [pass, total] }) =>
                      `<td class="test-bar" ${gradientBar(pass, total)}>
                        ${pass} / ${total}
                      </td>`,
                  )
                  .join('')}
              </tr>`,
          )
          .join('')}
    </tbody>
  </table>
  `;
  fs.writeFileSync(`${testResultsFolder}/${fileName}.html`, tableHtml);
}
