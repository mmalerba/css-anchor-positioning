import fetchMock from 'fetch-mock';

import {
  INLINE_STYLES_ATTRIBUTE,
  readCssSources,
  writeCssSources,
} from '../../../src/redesign/source.js';
import { getSampleCSS } from '../../helpers.js';

describe('readCssSources', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('reads style tag CSS', async () => {
    document.head.innerHTML = `<style>div {color: red}</style>`;
    const cssSources = await readCssSources();
    expect(cssSources).toHaveLength(1);
    expect(cssSources[0].css).toBe('div {color: red}');
  });

  it('reads linked CSS', async () => {
    const css = getSampleCSS('anchor-positioning');
    fetchMock.getOnce('end:sample.css', css);

    document.head.innerHTML = `<link type="text/css" href="/sample.css" />`;
    const cssSources = await readCssSources();

    expect(cssSources).toHaveLength(1);
    expect(cssSources[0].css).toBe(css);
    expect(cssSources[0].url?.toString()).toBe(`${location.origin}/sample.css`);
  });

  it('reads style attribute CSS', async () => {
    document.body.innerHTML = `<div style="color: red"></div>`;
    const cssSources = await readCssSources();
    expect(cssSources).toHaveLength(1);
    expect(cssSources[0].css).includes(`[${INLINE_STYLES_ATTRIBUTE}=`);
  });

  it('skips reading tags with no styles', async () => {
    document.head.innerHTML = `
      <style></style>
      <link rel="stylesheet" />
    `;
    document.body.innerHTML = `<div style=""></div>`;
    const cssSources = await readCssSources();
    expect(cssSources).toHaveLength(0);
  });

  it('gets multiple kinds of styles', async () => {
    const css = getSampleCSS('anchor-positioning');
    fetchMock.getOnce('end:sample.css', css);

    document.head.innerHTML = `
      <style>div {color: red}</style>
      <link rel="stylesheet" href="/sample.css" />
    `;
    document.body.innerHTML = `
      <div style="left: 0"></div>
      <style>span {right: 0}</style>
    `;
    const cssSources = await readCssSources();
    expect(cssSources).toHaveLength(4);
    expect(cssSources.map(({ css }) => css)).toEqual([
      'div {color: red}',
      css,
      expect.stringContaining(`[${INLINE_STYLES_ATTRIBUTE}=`),
      'span {right: 0}',
    ]);
  });

  it('gets styles for specific selector', async () => {
    document.head.innerHTML = `
      <style>div {color: red}</style>
      <link rel="stylesheet" hred="/sample.css" />
    `;
    document.body.innerHTML = `
      <div style="left: 0"></div>
      <style>span {right: 0}</style>
    `;
    const cssSources = await readCssSources('style');
    expect(cssSources).toHaveLength(2);
    expect(cssSources[0].css).toEqual('div {color: red}');
    expect(cssSources[1].css).toEqual('span {right: 0}');
  });
});

describe('writeCssSources', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();

    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('writes style tag CSS', async () => {
    document.head.innerHTML = `<style>div {color: red}</style>`;
    const [source] = await readCssSources();
    const newCss = `div {color: green}`;
    source.css = newCss;
    source.dirty = true;
    const styleTag = document.head.querySelector('style');
    expect(styleTag?.innerHTML).not.toBe(newCss);
    await writeCssSources([source]);
    expect(styleTag?.innerHTML).toBe(newCss);
  });

  it('writes linked CSS', async () => {
    fetchMock.getOnce('end:sample.css', 'div {color: red;}');

    document.head.innerHTML = '<link type="text/css" href="/sample.css" />';
    const [source] = await readCssSources();
    source.css = 'div {color: green}';
    source.dirty = true;
    const originalLinkTag = document.head.querySelector('link')!;
    expect(originalLinkTag.href).toBe(`${location.origin}/sample.css`);

    vi.spyOn(HTMLLinkElement.prototype, 'onload', 'set').mockImplementation(
      (f: any) => f(),
    );
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:newstyles'),
      revokeObjectURL: vi.fn(),
    });

    await writeCssSources([source]);
    const newLinkTag = document.head.querySelector('link')!;
    expect(newLinkTag).not.toBe(originalLinkTag);
    expect(newLinkTag?.href).toBe('blob:newstyles');
  });

  it('writes inline CSS', async () => {
    document.body.innerHTML = '<div style="color: red"></div>';
    const [source] = await readCssSources();
    source.css = source.css.replace('red', 'green');
    source.dirty = true;
    await writeCssSources([source]);
    expect(document.body.querySelector('div')?.getAttribute('style')).toBe(
      'color: green',
    );
  });

  it('does not write sources that are not dirty', async () => {
    fetchMock.getOnce('end:sample.css', 'div {color: red;}');

    document.head.innerHTML = `
      <style>div {color: red;}</style>
      <link type="text/css" href="/sample.css" />
    `;
    document.body.innerHTML = '<div style="color: red"></div>';
    const head = document.head.innerHTML;
    const body = document.body.innerHTML;
    const sources = await readCssSources();
    expect(sources).toHaveLength(3);
    sources.forEach((source) => {
      source.css = source.css.replace('red', 'green');
    });
    await writeCssSources(sources);
    expect(document.head.innerHTML).toBe(head);
    expect(document.body.innerHTML).toBe(body);
  });
});
