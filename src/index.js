/**
 * DNS Character String — encode/decode length-prefixed character-strings used in
 * DNS TXT and HINFO records.
 *
 * Exports:
 *   - encodeCharacterString(text: string): Uint8Array
 *   - decodeCharacterString(data: Uint8Array): DecodeResult
 *   - decodeCharacterStringStrict(data: Uint8Array): string
 *   - MAX_CHARACTER_STRING_LENGTH: number (255)
 *   - CharacterStringError: Error subclass
 *   - DecodeResult: { value: string, bytesRead: number }
 *
 * Design choice: the decoder is *length-strict*. The leading length byte tells us
 * exactly how many bytes belong to this string; any trailing data is left for the
 * caller to consume. This matches how a parser walks a TXT record (which is a
 * sequence of character-strings) and avoids guessing at record boundaries.
 */

export {
  encodeCharacterString,
  decodeCharacterString,
  decodeCharacterStringStrict,
  MAX_CHARACTER_STRING_LENGTH,
  CharacterStringError,
} from "./core.js";

/**
 * @typedef {Object} DecodeResult
 * @property {string} value        - The decoded character-string.
 * @property {number} bytesRead    - Number of bytes consumed from `data` (length prefix + body).
 */
