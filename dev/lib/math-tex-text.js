/**
 * @import {Construct, Previous, State, Token, TokenizeContext, Tokenizer} from 'micromark-util-types'
 */

import {ok as assert} from 'devlop'
import {markdownLineEnding} from 'micromark-util-character'
import {codes, types} from 'micromark-util-symbol'
import {mathText} from './math-text.js'

/** @type {Construct} */
export const mathTexText = {
  tokenize: tokenizeMathText,
  resolve: mathText().resolve,
  previous,
  name: 'mathTexText'
}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
function tokenizeMathText(effects, ok, nok) {
  const self = this
  /** @type {Token} */
  let token
  /** @type {number} */
  let openSequenceCode

  return start

  /**
   * Start of math (text).
   *
   * ```markdown
   * > | \(a\)
   *     ^
   * > | \\(a\)
   *      ^
   * ```
   *
   * @type {State}
   */
  function start(code) {
    assert(code === codes.backslash, 'expected `\\`')
    assert(previous.call(self, self.previous), 'expected correct previous')
    effects.enter('mathText')
    effects.enter('mathTextSequence')
    effects.consume(code)
    return sequenceOpen
  }

  /**
   * In opening sequence.
   *
   * ```markdown
   * > | \(a\)
   *      ^
   * > | \[a\]
   *      ^
   * ```
   *
   * @type {State}
   */
  function sequenceOpen(code) {
    if (code !== codes.leftParenthesis && code !== codes.leftSquareBracket) {
      return nok(code)
    }

    openSequenceCode = code
    effects.consume(code)
    effects.exit('mathTextSequence')
    return between
  }

  /**
   * Between something and something else.
   *
   * ```markdown
   * > | \(a\)
   *       ^^^
   * ```
   *
   * @type {State}
   */
  function between(code) {
    if (code === codes.eof) {
      return nok(code)
    }

    if (code === codes.backslash) {
      token = effects.enter('mathTextSequence')
      effects.consume(code)
      return sequenceClose
    }

    // Tabs don’t work, and virtual spaces don’t make sense.
    if (code === codes.space) {
      effects.enter('space')
      effects.consume(code)
      effects.exit('space')
      return between
    }

    if (markdownLineEnding(code)) {
      effects.enter(types.lineEnding)
      effects.consume(code)
      effects.exit(types.lineEnding)
      return between
    }

    // Data.
    effects.enter('mathTextData')
    return data(code)
  }

  /**
   * In data.
   *
   * ```markdown
   * > | \(a\)
   *       ^
   * ```
   *
   * @type {State}
   */
  function data(code) {
    if (
      code === codes.eof ||
      code === codes.space ||
      code === codes.backslash ||
      markdownLineEnding(code)
    ) {
      effects.exit('mathTextData')
      return between(code)
    }

    effects.consume(code)
    return data
  }

  /**
   * In closing sequence.
   *
   * ```markdown
   * > | \(a\)
   *         ^
   * ```
   *
   * @type {State}
   */
  function sequenceClose(code) {
    // Done!
    const closeSequenceCode =
      openSequenceCode === codes.leftParenthesis
        ? codes.rightParenthesis
        : codes.rightSquareBracket
    if (code === closeSequenceCode) {
      effects.consume(code)
      effects.exit('mathTextSequence')
      effects.exit('mathText')
      return ok(code)
    }

    // Escape
    if (code === codes.backslash) {
      effects.consume(code)
      token.type = 'mathTextData'
      return data
    }

    // More or less accents: mark as data.
    token.type = 'mathTextData'
    return data(code)
  }
}

/**
 * @this {TokenizeContext}
 * @type {Previous}
 */
function previous(code) {
  // If there is a previous code, there will always be a tail.
  return code !== codes.backslash
}
