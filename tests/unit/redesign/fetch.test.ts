import fetchMock from 'fetch-mock';

import { UUID_ATTR } from '../../../src/redesign/const.js';
import { fetchCssSources } from '../../../src/redesign/phases/fetch.js';
import { getSampleCSS } from '../../helpers.js';

describe('fetchCssSources', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('fetches style tag CSS', async () => {
    document.head.innerHTML = `<style>div {color: red}</style>`;
    const cssSources = await fetchCssSources();
    expect(cssSources).toHaveLength(1);
    expect(cssSources[0].css).toBe('div {color: red}');
  });

  it('fetches libked CSS', async () => {
    document.head.innerHTML = `<link type="text/css" href="/sample.css" />`;
    const css = getSampleCSS('anchor-positioning');
    fetchMock.getOnce('end:sample.css', css);
    const cssSources = await fetchCssSources();

    expect(cssSources).toHaveLength(1);
    expect(cssSources[0].css).toBe(css);
    expect(cssSources[0].url?.toString()).toBe(`${location.origin}/sample.css`);
  });

  it('fetches style attribute CSS', async () => {
    document.body.innerHTML = `<div style="color: red"></div>`;
    const cssSources = await fetchCssSources();
    expect(cssSources).toHaveLength(1);
    expect(cssSources[0].css).includes(`[${UUID_ATTR}=`);
  });

  it('skips tags with no styles', async () => {
    document.head.innerHTML = `
      <style></style>
      <link rel="stylesheet" />
    `;
    document.body.innerHTML = `<div style=""></div>`;
    const cssSources = await fetchCssSources();
    expect(cssSources).toHaveLength(0);
  });

  it('gets multiple kinds of styles', async () => {
    document.head.innerHTML = `
      <style>div {color: red}</style>
      <link rel="stylesheet" href="/sample.css" />
    `;
    document.body.innerHTML = `
      <div style="left: 0"></div>
      <style>span {right: 0}</style>
    `;
    const css = getSampleCSS('anchor-positioning');
    fetchMock.getOnce('end:sample.css', css);
    const cssSources = await fetchCssSources();
    expect(cssSources).toHaveLength(4);
    expect(cssSources.map(({ css }) => css)).toEqual([
      'div {color: red}',
      css,
      expect.stringContaining(`[${UUID_ATTR}=`),
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
    const cssSources = await fetchCssSources('style');
    expect(cssSources).toHaveLength(2);
    expect(cssSources[0].css).toEqual('div {color: red}');
    expect(cssSources[1].css).toEqual('span {right: 0}');
  });
});
