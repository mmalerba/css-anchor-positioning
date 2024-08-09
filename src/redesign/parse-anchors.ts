import * as csstree from 'css-tree';
import {
  generateCss,
  isFunction,
  isIdentifier,
  isNumber,
  isOperator,
  isParentheses,
  isPercentage,
  isValue,
  parseCssValue,
  replace,
} from './utils/ast.js';
import {
  ANCHOR_SIDE_VALUES,
  ANCHOR_SIZE_VALUES,
  AnchorName,
  AnchorSide,
  AnchorSideKeyword,
  AnchorSize,
} from './utils/properties.js';
import { makeCssProperty, type UuidCssProperty } from './utils/uuid.js';

/** The name of the `anchor()` function. */
const ANCHOR_FUNCTION_NAME = 'anchor';

/** The name of the `anchor-size()` function. */
const ANCHOR_SIZE_FUNCTION_NAME = 'anchor-size';

/** Represents an instance of the `anchor()` functiom. */
interface AnchorFunction {
  /** The name of the function. */
  functionName: typeof ANCHOR_FUNCTION_NAME;
  /** The property used as a placeholder for the resolved function value. */
  customProperty: UuidCssProperty;
  /** The name of the anchor passed to the function. */
  anchorName: AnchorName;
  /** The side passed to the function. */
  side: AnchorSide;
  /** The fallback value for the function. */
  fallbackValue?: string;
}

/** Represents an instance of the `anchor-size()` function. */
interface AnchorSizeFunction {
  /** The name of the function. */
  functionName: typeof ANCHOR_SIZE_FUNCTION_NAME;
  /** The property used as a placeholder for the resolved function value. */
  customProperty: UuidCssProperty;
  /** The name of the anchor passed to the function */
  anchorName: AnchorName;
  /** The size passed to the function. */
  size: AnchorSize;
  /** The fallback value for the function. */
  fallbackValue?: string;
}

/** Represents a value containing one or more anchor functions. */
interface ValueWithAnchorFunctions {
  /**
   * A polyfilled version of the property value, where the anchor functions are
   * replaced with CSS custom property placeholders. This allows updating the
   * value via the custom property as the position changes.
   */
  polyfilledValue: string;
  /** The anchor functions used in this value. */
  anchorFunctions: (AnchorFunction | AnchorSizeFunction)[];
}

/**
 * Parse all the anchor functions out of a value. Returns null if no valid
 * anchor functions are found.
 */
function parseAnchorFunctions(value: string): ValueWithAnchorFunctions | null {
  // Quick check to see if we should bother parsing.
  if (
    !(
      value.includes(`${ANCHOR_FUNCTION_NAME}(`) ||
      value.includes(`${ANCHOR_SIZE_FUNCTION_NAME}(`)
    )
  ) {
    return null;
  }

  const ast = parseCssValue(value);
  if (isValue(ast)) {
    const valueWithAnchors: ValueWithAnchorFunctions = {
      polyfilledValue: value,
      anchorFunctions: [],
    };
    csstree.walk(ast, {
      visit: 'Function',
      enter: function (node) {
        if (
          node.name === ANCHOR_FUNCTION_NAME ||
          node.name === ANCHOR_SIZE_FUNCTION_NAME
        ) {
          const anchorFunction = parseAnchorFunction(node);
          if (anchorFunction) {
            valueWithAnchors.anchorFunctions.push(anchorFunction);
            replace(node, {
              type: 'Raw',
              value: `var(${anchorFunction.customProperty})`,
            });
          }
        }
      },
    });
    if (valueWithAnchors.anchorFunctions.length) {
      valueWithAnchors.polyfilledValue = csstree.generate(ast);
      return valueWithAnchors;
    }
  }
  return null;
}

/**
 * Parse an anchor function from the given node. Returns null if a valid anchor
 * function cannot be parsed.
 */
function parseAnchorFunction(
  node: csstree.FunctionNode,
): AnchorFunction | AnchorSizeFunction | null {
  // Separate the function arguments from the fallback value.
  const args: csstree.CssNode[] = [];
  const children = node.children.toArray();
  while (children.length && !isOperator(children[0], ',')) {
    args.push(children.shift() as csstree.CssNode);
  }
  if (!(args.length === 1 || args.length === 2)) {
    return null;
  }

  // Remove the comma operator and serialize the fallback value.
  children.shift();
  const fallbackValueNode = children.map(generateCss).join('');

  // Parse the anchor function arguments.
  const name = args[1] === undefined ? 'implicit' : parseAnchorName(args[0]);
  const sideOrSizeNode = args[1] === undefined ? args[0] : args[1];
  if (!name) {
    return null;
  }

  // Parse the side or size and return.
  if (node.name === ANCHOR_FUNCTION_NAME) {
    const side = parseAnchorSide(sideOrSizeNode);
    if (side) {
      return {
        functionName: ANCHOR_FUNCTION_NAME,
        anchorName: name,
        customProperty: makeCssProperty(ANCHOR_FUNCTION_NAME),
        side,
        fallbackValue: fallbackValueNode,
      };
    }
  } else if (node.name === ANCHOR_SIZE_FUNCTION_NAME) {
    const size = parseAnchorSize(sideOrSizeNode);
    if (size) {
      return {
        functionName: ANCHOR_SIZE_FUNCTION_NAME,
        anchorName: name,
        customProperty: makeCssProperty(ANCHOR_SIZE_FUNCTION_NAME),
        size,
        fallbackValue: fallbackValueNode,
      };
    }
  }

  return null;
}

/**
 * Parse an anchor name from the given node. Returns null if a valid anchor name
 * cannot be parsed.
 */
function parseAnchorName(node: csstree.CssNode): AnchorName | null {
  if (
    node &&
    isIdentifier(node) &&
    (node.name.startsWith('--') || node.name === 'implicit')
  ) {
    return node.name as AnchorName;
  }
  return null;
}

/**
 * Parse a value for the anchor-size function's side parameter from the given
 * node. Returns null if a valid side cannot be parsed.
 */
function parseAnchorSide(node: csstree.CssNode): AnchorSide | null {
  if (
    isIdentifier(node) &&
    ANCHOR_SIDE_VALUES.has(node.name as AnchorSideKeyword)
  ) {
    return node.name as AnchorSide;
  } else if (isPercentage(node)) {
    return `${node.value}%` as AnchorSide;
  } else if (isFunction(node, 'calc') && isPercentCalc(node)) {
    return generateCss(node) as AnchorSide;
  }
  return null;
}

/**
 * Parse a value for the anchor-size function's size parameter from the given
 * node. Returns null if a valid size cannot be parsed.
 */
function parseAnchorSize(node: csstree.CssNode): AnchorSize | null {
  if (isIdentifier(node) && ANCHOR_SIZE_VALUES.has(node.name as AnchorSize)) {
    return node.name as AnchorSize;
  }
  return null;
}

/** Checks if the given calc function uses only percents and unitless values. */
function isPercentCalc(
  node: csstree.FunctionNode | csstree.Parentheses,
): boolean {
  return [...node.children].every(
    (child) =>
      isPercentage(child) ||
      isNumber(child) ||
      isOperator(child) ||
      ((isFunction(child, 'calc') || isParentheses(child)) &&
        isPercentCalc(child)),
  );
}
