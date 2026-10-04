/**
 * Encode and decode DNS character-strings per RFC 1035 §3.3.
 *
 * A character-string is a single length octet followed by that many octets of text.
 * The maximum body length is 255 (one octet can only express 0–255). The length
 * prefix therefore caps the total wire form at 256 bytes.
 *
 * Text is treated as a byte string: each UTF-8 byte produced by TextEncoder maps
 * one-to-one onto a wire octet. This mirrors how real DNS servers store TXT payloads —
 * they are opaque byte sequences, not Unicode strings. A decoder that tried to be
 * clever about code points would mis-split multi-byte sequences and corrupt data.
 */

/** Maximum number of data octets in a single character-string (length prefix is one octet). */
export const MAX_CHARACTER_STRING_LENGTH = 255;

/**
 * Raised on malformed input — a length prefix larger than the remaining buffer,
 * or an encoder input whose UTF-8 byte length exceeds 255.
 */
export class CharacterStringError extends Error {
  /**
   * @param {string} message
   * @param {{code?: string, [key: string]: unknown}=} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = "CharacterStringError";
    if (options.code !== undefined) this.code = options.code;
    for (const key of Object.keys(options)) {
      if (key !== "code") this[key] = options[key];
    }
    // Restore the prototype chain: a subclass of Error created via transpilers
    // can otherwise lose its `instanceof` identity.
    if (typeof Object.setPrototypeOf === "function") {
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true }); // reject lone surrogates / truncated sequences

/**
 * Encode a text string into a length-prefixed character-string.
 *
 * The input is UTF-8 encoded; if that encoding exceeds 255 bytes a
 * `CharacterStringError` with `code: "TOO_LONG"` is thrown. We deliberately do
 * not truncate — silent truncation would produce a TXT record that says
 * something different from what the caller intended.
 *
 * @param {string} text
 * @returns {Uint8Array} A new buffer of length `1 + byteLength(text)`.
 * @throws {CharacterStringError} If the UTF-8 byte length exceeds 255.
 */
export function encodeCharacterString(text) {
  if (typeof text !== "string") {
    throw new CharacterStringError("encodeCharacterString expects a string", {
      code: "INVALID_INPUT",
    });
  }
  const body = textEncoder.encode(text);
  if (body.length > MAX_CHARACTER_STRING_LENGTH) {
    throw new CharacterStringError(
      `character-string body is ${body.length} bytes; maximum is ${MAX_CHARACTER_STRING_LENGTH}`,
      { code: "TOO_LONG", length: body.length }
    );
  }
  const out = new Uint8Array(body.length + 1);
  out[0] = body.length;
  out.set(body, 1);
  return out;
}

/**
 * Decode a single character-string from the start of `data`.
 *
 * Only the bytes described by the length prefix are consumed; anything after is
 * the caller's responsibility. This is the right behaviour for TXT records,
 * which concatenate multiple character-strings, and it keeps the decoder honest
 * about what it actually parsed.
 *
 * Returns `{ value, bytesRead }` so callers can advance a cursor without
 * recomputing the length. `bytesRead` is always `1 + length`.
 *
 * @param {Uint8Array} data
 * @returns {{ value: string, bytesRead: number }}
 * @throws {CharacterStringError} If `data` is empty or the length prefix exceeds the remaining bytes.
 */
export function decodeCharacterString(data) {
  if (!(data instanceof Uint8Array)) {
    throw new CharacterStringError("decodeCharacterString expects a Uint8Array", {
      code: "INVALID_INPUT",
    });
  }
  if (data.length === 0) {
    throw new CharacterStringError("data is empty; missing length prefix", {
      code: "TRUNCATED",
    });
  }
  const length = data[0];
  if (length + 1 > data.length) {
    throw new CharacterStringError(
      `length prefix is ${length} but only ${data.length - 1} data bytes remain`,
      { code: "TRUNCATED", declared: length, available: data.length - 1 }
    );
  }
  const body = data.subarray(1, 1 + length);
  const value = textDecoder.decode(body);
  return { value, bytesRead: length + 1 };
}

/**
 * Decode a character-string and insist that it consumes the entire input.
 *
 * Convenience for the common case where a caller has exactly one character-string
 * in a buffer and trailing bytes would indicate a protocol error.
 *
 * @param {Uint8Array} data
 * @returns {string}
 * @throws {CharacterStringError} If decoding fails or trailing bytes remain.
 */
export function decodeCharacterStringStrict(data) {
  const { value, bytesRead } = decodeCharacterString(data);
  if (bytesRead !== data.length) {
    throw new CharacterStringError(
      `strict decode: consumed ${bytesRead} of ${data.length} bytes; trailing data is not allowed`,
      { code: "TRAILING_DATA", bytesRead, total: data.length }
    );
  }
  return value;
}
