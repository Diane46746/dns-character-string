import { test } from "node:test";
import assert from "node:assert/strict";

import {
  encodeCharacterString,
  decodeCharacterString,
  decodeCharacterStringStrict,
  MAX_CHARACTER_STRING_LENGTH,
  CharacterStringError,
} from "../src/index.js";

const enc = (s) => new TextEncoder().encode(s);
const cat = (a, ...rest) => {
  const total = a.length + rest.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  out.set(a, 0);
  let off = a.length;
  for (const b of rest) {
    out.set(b, off);
    off += b.length;
  }
  return out;
};

test("encode produces a length prefix followed by the body", () => {
  const out = encodeCharacterString("hello");
  assert.deepEqual(Array.from(out), [5, 104, 101, 108, 108, 111]);
});

test("encode of empty string is a single zero byte", () => {
  const out = encodeCharacterString("");
  assert.deepEqual(Array.from(out), [0]);
});

test("decode round-trips a plain ASCII string", () => {
  const wire = encodeCharacterString("v=spf1 -all");
  const { value, bytesRead } = decodeCharacterString(wire);
  assert.equal(value, "v=spf1 -all");
  assert.equal(bytesRead, wire.length);
});

test("decode handles an empty character-string", () => {
  const wire = new Uint8Array([0]);
  const { value, bytesRead } = decodeCharacterString(wire);
  assert.equal(value, "");
  assert.equal(bytesRead, 1);
});

test("decode only consumes the bytes the length prefix declares", () => {
  const wire = cat(encodeCharacterString("hi"), enc("garbage"));
  const { value, bytesRead } = decodeCharacterString(wire);
  assert.equal(value, "hi");
  assert.equal(bytesRead, 3); // 1 length + 2 body
});

test("decode rejects an empty buffer", () => {
  assert.throws(
    () => decodeCharacterString(new Uint8Array(0)),
    (e) => e instanceof CharacterStringError && e.code === "TRUNCATED"
  );
});

test("decode rejects a length prefix larger than the remaining bytes", () => {
  const wire = new Uint8Array([10, 1, 2, 3]);
  assert.throws(
    () => decodeCharacterString(wire),
    (e) => e instanceof CharacterStringError && e.code === "TRUNCATED"
  );
});

test("decode round-trips multi-byte UTF-8 (emoji)", () => {
  const text = "café ☕ 🚀";
  const wire = encodeCharacterString(text);
  const { value } = decodeCharacterString(wire);
  assert.equal(value, text);
});

test("decode rejects a truncated UTF-8 sequence", () => {
  // 0xC3 0xA9 is 'é'; dropping the continuation byte yields invalid UTF-8.
  const wire = new Uint8Array([1, 0xC3]);
  assert.throws(
    () => decodeCharacterString(wire),
    (e) => e instanceof CharacterStringError || e instanceof TypeError
  );
});

test("encode rejects input longer than 255 bytes", () => {
  const long = "a".repeat(256);
  assert.throws(
    () => encodeCharacterString(long),
    (e) => e instanceof CharacterStringError && e.code === "TOO_LONG"
  );
});

test("encode accepts input of exactly 255 bytes", () => {
  const text = "a".repeat(MAX_CHARACTER_STRING_LENGTH);
  const wire = encodeCharacterString(text);
  assert.equal(wire.length, 256);
  assert.equal(wire[0], MAX_CHARACTER_STRING_LENGTH);
  assert.equal(decodeCharacterString(wire).value, text);
});

test("encode rejects non-string input", () => {
  assert.throws(
    () => encodeCharacterString(42),
    (e) => e instanceof CharacterStringError && e.code === "INVALID_INPUT"
  );
});

test("decode rejects non-Uint8Array input", () => {
  assert.throws(
    () => decodeCharacterString("hello"),
    (e) => e instanceof CharacterStringError && e.code === "INVALID_INPUT"
  );
});

test("strict decode succeeds when bytes are exact", () => {
  const wire = encodeCharacterString("exact");
  assert.equal(decodeCharacterStringStrict(wire), "exact");
});

test("strict decode rejects trailing bytes", () => {
  const wire = cat(encodeCharacterString("a"), new Uint8Array([0xFF]));
  assert.throws(
    () => decodeCharacterStringStrict(wire),
    (e) => e instanceof CharacterStringError && e.code === "TRAILING_DATA"
  );
});
