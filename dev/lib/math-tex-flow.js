/**
 * @import {Construct, State, TokenizeContext, Tokenizer} from 'micromark-util-types'
 */

import {ok as assert} from 'devlop'
import {factorySpace} from 'micromark-factory-space'
import {markdownLineEnding} from 'micromark-util-character'
import {codes, constants, types} from 'micromark-util-symbol'

/** @type {Construct} */
export const mathTexFlow = {
  tokenize: tokenizeMathFenced,
  concrete: true,
  name: 'mathTexFlow'
}

/** @type {Construct} */
const nonLazyContinuation = {
  tokenize: tokenizeNonLazyContinuation,
  partial: true
}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
function tokenizeMathFenced(effects, ok, nok) {
  const self = this
  const tail = self.events[self.events.length - 1]
  const initialSize =
    tail && tail[1].type === types.linePrefix
      ? tail[2].sliceSerialize(tail[1], true).length
      : 0

  return start

  /**
   * Start of math.
   *
   * ```markdown
   * > | \[
   *     ^
   *   | \frac{1}{2}
   *   | \]
   * ```
   *
   * @type {State}
   */
  function start(code) {
    assert(code === codes.backslash, 'expected `\\`')
    effects.enter('mathFlow')
    effects.enter('mathFlowFence')
    effects.enter('mathFlowFenceSequence')
    effects.consume(code)
    return sequenceOpen
  }

  /**
   * In opening fence sequence.
   *
   * ```markdown
   * > | \[
   *      ^
   *   | \frac{1}{2}
   *   | \]
   * ```
   *
   * @type {State}
   */
  function sequenceOpen(code) {
    if (code !== codes.leftSquareBracket) {
      return nok(code)
    }

    effects.consume(code)
    effects.exit('mathFlowFenceSequence')
    return factorySpace(effects, metaAfter, types.whitespace)
  }

  /**
   * After meta.
   *
   * ```markdown
   * > | \[
   *       ^
   *   | \frac{1}{2}
   *   | \]
   * ```
   *
   * @type {State}
   */
  function metaAfter(code) {
    effects.exit('mathFlowFence')

    if (self.interrupt) {
      return ok(code)
    }

    return effects.attempt(
      nonLazyContinuation,
      beforeNonLazyContinuation,
      after
    )(code)
  }

  /**
   * After eol/eof in math, at a non-lazy closing fence or content.
   *
   * ```markdown
   *   | \[
   * > | \frac{1}{2}
   *     ^
   * > | \]
   *     ^
   * ```
   *
   * @type {State}
   */
  function beforeNonLazyContinuation(code) {
    if (code === codes.eof) {
      return after(code)
    }

    return effects.attempt(
      {tokenize: tokenizeClosingFence, partial: true},
      after,
      contentStart
    )(code)
  }

  /**
   * Before math content, definitely not before a closing fence.
   *
   * ```markdown
   *   | \[
   * > | \frac{1}{2}
   *     ^
   *   | \]
   * ```
   *
   * @type {State}
   */
  function contentStart(code) {
    return (
      initialSize
        ? factorySpace(
            effects,
            beforeContentChunk,
            types.linePrefix,
            initialSize + 1
          )
        : beforeContentChunk
    )(code)
  }

  /**
   * Before math content, after optional prefix.
   *
   * ```markdown
   *   | \[
   * > | \frac{1}{2}
   *     ^
   *   | \]
   * ```
   *
   * @type {State}
   */
  function beforeContentChunk(code) {
    if (code === codes.eof) {
      return after(code)
    }

    if (code === codes.backslash) {
      return effects.attempt(
        {tokenize: tokenizeNonClosingContinuation, partial: true},
        contentChunk,
        beforeContentChunkContinuation
      )(code)
    }

    if (markdownLineEnding(code)) {
      return effects.attempt(
        nonLazyContinuation,
        beforeNonLazyContinuation,
        after
      )(code)
    }

    effects.enter('mathFlowValue')
    return contentChunk(code)
  }

  /** @type {State} */
  function beforeContentChunkContinuation(code) {
    return effects.attempt(
      {tokenize: tokenizeClosingFence, partial: true},
      after,
      continueContentChunk
    )(code)
  }

  /** @type {State} */
  function continueContentChunk(code) {
    effects.enter('mathFlowValue')
    effects.consume(code)
    return contentChunk
  }

  /**
   * In math content.
   *
   * ```markdown
   *   | \[
   * > | \frac{1}{2}
   *      ^
   *   | \]
   * ```
   *
   * @type {State}
   */
  function contentChunk(code) {
    if (
      code === codes.eof ||
      code === codes.backslash ||
      markdownLineEnding(code)
    ) {
      effects.exit('mathFlowValue')
      return beforeContentChunk(code)
    }

    effects.consume(code)
    return contentChunk
  }

  /**
   * After math (ha!).
   *
   * ```markdown
   *   | \[
   *   | \frac{1}{2}
   * > | \]
   *       ^
   * ```
   *
   * @type {State}
   */
  function after(code) {
    effects.exit('mathFlow')
    return ok(code)
  }

  /** @type {Tokenizer} */
  function tokenizeClosingFence(effects, ok, nok) {
    assert(self.parser.constructs.disable.null, 'expected `disable.null`')
    /**
     * Before closing fence, at optional whitespace.
     *
     * ```markdown
     *   | \[
     *   | \frac{1}{2}
     * > | \]
     *     ^
     * ```
     */
    return factorySpace(
      effects,
      beforeSequenceClose,
      types.linePrefix,
      self.parser.constructs.disable.null.includes('codeIndented')
        ? undefined
        : constants.tabSize
    )

    /**
     * In closing fence, after optional whitespace, at sequence.
     *
     * ```markdown
     *   | \[
     *   | \frac{1}{2}
     * > | \]
     *     ^
     * ```
     *
     * @type {State}
     */
    function beforeSequenceClose(code) {
      effects.enter('mathFlowFence')
      effects.enter('mathFlowFenceSequence')
      effects.consume(code)
      return sequenceClose
    }

    /**
     * In closing fence sequence.
     *
     * ```markdown
     *   | \[
     *   | \frac{1}{2}
     * > | \]
     *      ^
     * ```
     *
     * @type {State}
     */
    function sequenceClose(code) {
      if (code !== codes.rightSquareBracket) {
        return nok(code)
      }

      effects.consume(code)
      effects.exit('mathFlowFenceSequence')
      return factorySpace(effects, afterSequenceClose, types.whitespace)
    }

    /**
     * After closing fence sequence, after optional whitespace.
     *
     * ```markdown
     *   | \[
     *   | \frac{1}{2}
     * > | \]
     *       ^
     * ```
     *
     * @type {State}
     */
    function afterSequenceClose(code) {
      if (code === codes.eof || markdownLineEnding(code)) {
        effects.exit('mathFlowFence')
        return ok(code)
      }

      return nok(code)
    }
  }
}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
function tokenizeNonLazyContinuation(effects, ok, nok) {
  const self = this

  return start

  /** @type {State} */
  function start(code) {
    if (code === null) {
      return ok(code)
    }

    if (markdownLineEnding(code)) {
      effects.enter(types.lineEnding)
      effects.consume(code)
      effects.exit(types.lineEnding)
      return lineStart
    }

    return lineStart(code)
  }

  /** @type {State} */
  function lineStart(code) {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
  }
}

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
function tokenizeNonClosingContinuation(effects, ok, nok) {
  return start

  /** @type {State} */
  function start(code) {
    assert(code === codes.backslash, 'expected `\\`')
    effects.enter('mathFlowValue')
    effects.consume(code)
    return sequenceStart
  }

  /** @type {State} */
  function sequenceStart(code) {
    return code === codes.rightSquareBracket ? nok(code) : ok(code)
  }
}
