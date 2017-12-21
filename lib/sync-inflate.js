import { ok as assert } from 'assert';
import zlib from 'zlib';
import { kMaxLength } from 'buffer';

export class Inflate extends zlib.Inflate {
  constructor(opts) {
    super();
    if (!(this instanceof Inflate)) {
      return new Inflate(opts);
    }

    if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
      opts.chunkSize = zlib.Z_MIN_CHUNK;
    }

    zlib.Inflate.call(this, opts);

    if (opts && opts.maxLength) {
      this._maxLength = opts.maxLength;
    }
  }

  _close(callback) {
    if (callback) {
      process.nextTick(callback);
    }

    // Caller may invoke .close after a zlib error (which will null _handle).
    if (!this._handle) {
      return;
    }

    this._handle.close();
    this._handle = null;
  }

  _processChunk(chunk, flushFlag, asyncCb) {
    if (typeof asyncCb === 'function') {
      return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
    }

    var self = this;

    var availInBefore = chunk && chunk.length;
    var availOutBefore = this._chunkSize - this._offset;
    var leftToInflate = this._maxLength;
    var inOff = 0;

    var buffers = [];
    var nread = 0;

    var error;
    this.on('error', function(err) {
      error = err;
    });

    function handleChunk(availInAfter, availOutAfter) {
      if (self._hadError) {
        return;
      }

      var have = availOutBefore - availOutAfter;
      assert(have >= 0, 'have should not go down');

      if (have > 0) {
        var out = self._buffer.slice(self._offset, self._offset + have);
        self._offset += have;

        if (out.length > leftToInflate) {
          out = out.slice(0, leftToInflate);
        }

        buffers.push(out);
        nread += out.length;
        leftToInflate -= out.length;

        if (leftToInflate === 0) {
          return false;
        }
      }

      if (availOutAfter === 0 || self._offset >= self._chunkSize) {
        availOutBefore = self._chunkSize;
        self._offset = 0;
        self._buffer = Buffer.allocUnsafe(self._chunkSize);
      }

      if (availOutAfter === 0) {
        inOff += (availInBefore - availInAfter);
        availInBefore = availInAfter;

        return true;
      }

      return false;
    }

    assert(this._handle, 'zlib binding closed');
    do {
      var res = this._handle.writeSync(
        flushFlag,
        chunk, // in
        inOff, // in_off
        availInBefore, // in_len
        this._buffer, // out
        this._offset, //out_off
        availOutBefore // out_len
      );
    } while (!this._hadError && handleChunk(res[0], res[1]));

    if (this._hadError) {
      throw error;
    }

    if (nread >= kMaxLength) {
      this._close();
      throw new RangeError('Cannot create final Buffer. It would be larger than 0x' + kMaxLength.toString(16) + ' bytes');
    }

    var buf = Buffer.concat(buffers, nread);
    this._close();

    return buf;
  }
}

export function createInflate(opts) {
  return new Inflate(opts);
}

export function zlibBufferSync(engine, buffer) {
  if (typeof buffer === 'string') {
    // eslint-disable-next-line
    buffer = Buffer.from(buffer);
  }
  if (!(buffer instanceof Buffer)) {
    throw new TypeError('Not a string or buffer');
  }

  var flushFlag = engine._finishFlushFlag || zlib.Z_FINISH;

  return engine._processChunk(buffer, flushFlag);
}

export default function inflateSync(buffer, opts) {
  return zlibBufferSync(new Inflate(opts), buffer);
}
