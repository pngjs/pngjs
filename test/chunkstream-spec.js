"use strict";

let test = require("tape");
let asyncHooks = require("async_hooks");
let ChunkStream = require("../lib/chunkstream");
let PNG = require("../lib/png").PNG;

test("unused PNG instances do not retain themselves in the next-tick queue", function (t) {
  let ticks = 0;
  let hook = asyncHooks.createHook({
    init: function (id, type) {
      if (type === "TickObject") ticks++;
    },
  });
  hook.enable();
  try {
    for (let i = 0; i < 100; i++) {
      new PNG({ width: 100, height: 100 });
    }
  } finally {
    hook.disable();
  }
  t.equal(ticks, 0, "no queued work keeps unused image buffers alive");
  t.end();
});

test("reads registered before input are fulfilled by subsequent writes", function (t) {
  let stream = new ChunkStream();
  let received = [];
  stream.read(2, function (data) {
    received.push(data.toString());
  });
  stream.read(-3, function (data) {
    received.push(data.toString());
  });
  t.equal(stream.write("a"), true, "waits for enough data");
  t.equal(
    stream.write("bcd"),
    false,
    "pauses once read requests are exhausted"
  );
  t.deepEqual(received, ["ab", "cd"]);
  stream.destroy();
  t.end();
});

test("a paused stream with no bytes drains asynchronously when a read arrives", function (t) {
  let stream = new ChunkStream();
  let returned = false;
  t.equal(stream.write(Buffer.alloc(0)), false);
  stream.on("drain", function () {
    t.ok(returned, "drain occurs after read returns");
    t.equal(stream.write("x"), false);
    stream.destroy();
    t.end();
  });
  stream.read(1, function (data) {
    t.equal(data.toString(), "x");
  });
  returned = true;
});

test("a read of already buffered bytes remains asynchronous", function (t) {
  let stream = new ChunkStream();
  let returned = false;
  t.equal(stream.write("ab"), false);
  stream.read(2, function (data) {
    t.ok(returned, "callback occurs after read returns");
    t.equal(data.toString(), "ab");
    stream.destroy();
    t.end();
  });
  returned = true;
});

test("ending an unread stream still reports truncated input and closes", function (t) {
  let stream = new ChunkStream();
  let events = [];
  stream.on("error", function (error) {
    events.push(error.message);
  });
  stream.on("close", function () {
    events.push("close");
  });
  stream.read(8, function () {
    t.fail("incomplete input must not reach the callback");
  });
  stream.end();
  t.deepEqual(events, ["Unexpected end of input", "close"]);
  t.end();
});
