import { parseAnchorFunctions } from '../../../src/redesign/parse.js';
import { UUID_PREFIX } from '../../../src/redesign/utils/uuid.js';

const UUID_PATTERN = new RegExp(String.raw`${UUID_PREFIX}\d+`);
const POLYFILLED_VALUE_PATTERN = new RegExp(
  String.raw`var\(--(anchor|anchor-size)-${UUID_PREFIX}\d+\)`,
);
const CUSTOM_PROPERTY_PATTERN = new RegExp(
  String.raw`--(anchor|anchor-size)-${UUID_PREFIX}\d+`,
);

describe('parseAnchors', () => {
  it('should parse `anchor()` function', () => {
    const value = parseAnchorFunctions(`anchor(--anchor top)`, 'anchor');
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(POLYFILLED_VALUE_PATTERN),
      anchorFunctions: [
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--anchor',
          side: 'top',
        },
      ],
    });
  });

  it('should parse `anchor-size()` function', () => {
    const value = parseAnchorFunctions(
      `anchor-size(--anchor width)`,
      'anchor-size',
    );
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(POLYFILLED_VALUE_PATTERN),
      anchorFunctions: [
        {
          functionName: 'anchor-size',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--anchor',
          size: 'width',
        },
      ],
    });
  });

  it('should parse multiple anchor functions', () => {
    const value = parseAnchorFunctions(
      `anchor(--anchor top) 5px anchor(--other bottom)`,
      'anchor',
    );
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(
        new RegExp(
          String.raw`${POLYFILLED_VALUE_PATTERN.source} 5px ${POLYFILLED_VALUE_PATTERN.source}`,
        ),
      ),
      anchorFunctions: [
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--anchor',
          side: 'top',
        },
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--other',
          side: 'bottom',
        },
      ],
    });
  });

  it('should parse anchor function with fallback', () => {
    const value = parseAnchorFunctions(`anchor(--anchor top, 10px)`, 'anchor');
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(POLYFILLED_VALUE_PATTERN),
      anchorFunctions: [
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--anchor',
          side: 'top',
          fallbackValue: '10px',
        },
      ],
    });
  });

  it('should parse anchor function inside calc', () => {
    const value = parseAnchorFunctions(
      `calc(2*anchor(--anchor top))`,
      'anchor',
    );
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(
        new RegExp(String.raw`calc\(2\*${POLYFILLED_VALUE_PATTERN.source}\)`),
      ),
      anchorFunctions: [
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--anchor',
          side: 'top',
        },
      ],
    });
  });

  it('should parse anchor function with implicit anchor', () => {
    const value = parseAnchorFunctions(`anchor(top)`, 'anchor');
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(POLYFILLED_VALUE_PATTERN),
      anchorFunctions: [
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: 'implicit',
          side: 'top',
        },
      ],
    });
  });

  it('should parse anchor function with side percentage', () => {
    const value = parseAnchorFunctions(`anchor(--anchor 8%)`, 'anchor');
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(POLYFILLED_VALUE_PATTERN),
      anchorFunctions: [
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--anchor',
          side: '8%',
        },
      ],
    });
  });

  it('should parse anchor function with side calc', () => {
    const value = parseAnchorFunctions(
      `anchor(--anchor calc((2/calc(2))*25%))`,
      'anchor',
    );
    expect(value).toEqual({
      uuid: expect.stringMatching(UUID_PATTERN),
      polyfilledValue: expect.stringMatching(POLYFILLED_VALUE_PATTERN),
      anchorFunctions: [
        {
          functionName: 'anchor',
          customProperty: expect.stringMatching(CUSTOM_PROPERTY_PATTERN),
          anchorSpecifier: '--anchor',
          side: 'calc((2/calc(2))*25%)',
        },
      ],
    });
  });

  it('should not parse value with no anchor functions', () => {
    const value = parseAnchorFunctions(`10%`, 'anchor');
    expect(value).toBeNull();
  });

  it('should not parse anchor with invalid name', () => {
    const value = parseAnchorFunctions(`anchor(invalid top)`, 'anchor');
    expect(value).toBeNull();
  });

  it('should not parse anchor with invalid side', () => {
    const value = parseAnchorFunctions(`anchor(--anchor invalid)`, 'anchor');
    expect(value).toBeNull();
  });

  it('should not parse anchor with invalid size', () => {
    const value = parseAnchorFunctions(
      `anchor-size(--anchor invalid)`,
      'anchor-size',
    );
    expect(value).toBeNull();
  });

  it('should not parse anchor with non-percent units in side calc', () => {
    const value = parseAnchorFunctions(
      `anchor(--anchor calc(2*25px))`,
      'anchor',
    );
    expect(value).toBeNull();
  });

  it('should not parse other anchor functions', () => {
    const value = parseAnchorFunctions(`anchor(--anchor top)`, 'anchor-size');
    expect(value).toBeNull();
  });
});
