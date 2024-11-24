/**
 * @import {Options} from 'micromark-extension-llm-math'
 * @import {Extension} from 'micromark-util-types'
 */

import {codes} from 'micromark-util-symbol'
import {mathFlow} from './math-flow.js'
import {mathText} from './math-text.js'
import {mathTexFlow} from './math-tex-flow.js'
import {mathTexText} from './math-tex-text.js'

/**
 * Create an extension for `micromark` to enable math syntax.
 *
 * @param {Options | null | undefined} [options={}]
 *   Configuration (default: `{}`).
 * @returns {Extension}
 *   Extension for `micromark` that can be passed in `extensions`, to
 *   enable math syntax.
 */
export function math(options) {
  return {
    flow: {[codes.dollarSign]: mathFlow, [codes.backslash]: mathTexFlow},
    text: {
      [codes.dollarSign]: mathText(options),
      [codes.backslash]: mathTexText
    }
  }
}
