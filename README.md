DNS Character String encodes and decodes the length-prefixed character-string format used in DNS TXT and HINFO records (RFC 1035 §3.3): one length octet followed by that many octets of text.

```js
import {
  encodeCharacterString,
  decodeCharacterString,
  decodeCharacterStringStrict,
} from "./src/index.js";

const wire = encodeCharacterString("v=spf1 -all");
// Uint8Array [ 11, 118, 61, 115, 112, 102, 49, 32, 45, 97, 108, 108 ]

const { value, bytesRead } = decodeCharacterString(wire);
// value === "v=spf1 -all", bytesRead === 12

const strict = decodeCharacterStringStrict(wire); // throws if trailing bytes remain
```

Exported names: `encodeCharacterString`, `decodeCharacterString`, `decodeCharacterStringStrict`, `MAX_CHARACTER_STRING_LENGTH` (255), `CharacterStringError`, and a `DecodeResult` typedef `{ value: string, bytesRead: number }`.

The single-length-octet design caps a character-string at 255 bytes of body. If you need to store more, the DNS convention is to chain multiple character-strings inside one TXT record — this library does not concatenate them for you, because the boundaries are meaningful and a naive join would misrepresent the wire data.

Text is UTF-8 encoded by `TextEncoder` and decoded with `TextDecoder` in fatal mode, so a truncated multi-byte sequence surfaces as an error rather than silent replacement. This is the awkward edge: TXT records are in practice opaque byte bags, and well-meaning callers sometimes put binary data in them. If you have such a payload, base64-encode it before passing it here; the library will not second-guess your bytes.

The non-strict decoder consumes only the bytes the length prefix declares and leaves any trailing data for the caller. The strict variant throws `code: "TRAILING_DATA"` if even one byte remains, which is what you want when a buffer is supposed to contain exactly one character-string.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

