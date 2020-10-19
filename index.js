/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-underscore-dangle */
const iconv = require('iconv-lite');
const linewrap = require('linewrap');

class EscPosEncoder {
  constructor() {
    this._reset();
  }

  // Reset the state of the object
  _reset() {
    this._buffer = [];
    // this._codepage = 'ascii';
    this._codepage = 'windows1250';

    this._state = {
      bold: false,
      italic: false,
      underline: false,
      hanzi: false,
    };
  }

  // Encode a string with the current code page
  _encode(value) {
    return iconv.encode(value, this._codepage);
  }

  // Add commands to the buffer
  _queue(value) {
    value.forEach((item) => this._buffer.push(item));
  }

  // Initialize the printer
  initialize() {
    this._queue([
      0x1b, 0x40,
    ]);

    return this;
  }

  // Change the code page
  codepage(value) {
    const codepages = {
      cp437: [0x00, false],
      cp737: [0x40, false],
      cp850: [0x02, false],
      cp775: [0x5f, false],
      cp852: [0x12, false],
      cp855: [0x3c, false],
      cp857: [0x3d, false],
      cp858: [0x13, false],
      cp860: [0x03, false],
      cp861: [0x38, false],
      cp862: [0x3e, false],
      cp863: [0x04, false],
      cp864: [0x1c, false],
      cp865: [0x05, false],
      cp866: [0x11, false],
      cp869: [0x42, false],
      cp936: [0xff, true],
      cp949: [0xfd, true],
      cp950: [0xfe, true],
      cp1252: [0x10, false],
      iso88596: [0x16, false],
      shiftjis: [0xfc, true],
      windows874: [0x1e, false],
      windows1250: [0x48, false],
      windows1251: [0x49, false],
      windows1252: [0x47, false],
      windows1253: [0x5a, false],
      windows1254: [0x5b, false],
      windows1255: [0x20, false],
      windows1256: [0x5c, false],
      windows1257: [0x19, false],
      windows1258: [0x5e, false],
    };

    let codepage;

    if (!iconv.encodingExists(value)) {
      throw new Error('Unknown codepage');
    }

    if (value in iconv.encodings) {
      if (typeof iconv.encodings[value] === 'string') {
        codepage = iconv.encodings[value];
      } else {
        codepage = value;
      }
    } else {
      throw new Error('Unknown codepage');
    }

    if (typeof codepages[codepage] !== 'undefined') {
      this._codepage = codepage;
      this._state.hanzi = codepages[codepage][1];

      this._queue([
        0x1b, 0x74, codepages[codepage][0],
      ]);
    } else {
      throw new Error('Codepage not supported by printer');
    }

    return this;
  }

  // Print text
  text(value, wrap) {
    if (wrap) {
      const w = linewrap(wrap, { lineBreak: '\r\n' });
      value = w(value);
    }

    const bytes = this._encode(value);

    if (this._state.hanzi) {
      this._queue([
        0x1c, 0x26, bytes, 0x1c, 0x2e,
      ]);
    } else {
      this._queue([
        bytes,
      ]);
    }

    return this;
  }

  // Print a newline
  newline() {
    this._queue([
      0x0a, 0x0d,
    ]);

    return this;
  }

  // Print text, followed by a newline
  line(value, wrap) {
    this.text(value, wrap);
    this.newline();

    return this;
  }

  // Underline text
  underline(value) {
    if (typeof value === 'undefined') {
      value = !this._state.underline;
    }

    this._state.underline = value;

    this._queue([
      0x1b, 0x2d, Number(value),
    ]);

    return this;
  }

  // Italic text
  italic(value) {
    if (typeof value === 'undefined') {
      value = !this._state.italic;
    }

    this._state.italic = value;

    this._queue([
      0x1b, 0x34, Number(value),
    ]);

    return this;
  }

  // Bold text
  bold(value) {
    if (typeof value === 'undefined') {
      value = !this._state.bold;
    }

    this._state.bold = value;

    this._queue([
      0x1b, 0x45, Number(value),
    ]);

    return this;
  }

  // Change text size
  size(value) {
    if (value === 'small') {
      value = 0x01;
    } else {
      value = 0x00;
    }

    this._queue([
      0x1b, 0x4d, value,
    ]);

    return this;
  }

  // Change text alignment
  align(value) {
    const alignments = {
      left: 0x00,
      center: 0x01,
      right: 0x02,
    };

    if (value in alignments) {
      this._queue([
        0x1b, 0x61, alignments[value],
      ]);
    } else {
      throw new Error('Unknown alignment');
    }

    return this;
  }

  // Barcode
  barcode(value, symbology, height) {
    const symbologies = {
      upca: 0x00,
      upce: 0x01,
      ean13: 0x02,
      ean8: 0x03,
      code39: 0x04,
      coda39: 0x04, /* typo, leave here for backwards compatibility */
      itf: 0x05,
      codabar: 0x06,
      code93: 0x48,
      code128: 0x49,
      'gs1-128': 0x50,
      'gs1-databar-omni': 0x51,
      'gs1-databar-truncated': 0x52,
      'gs1-databar-limited': 0x53,
      'gs1-databar-expanded': 0x54,
      'code128-auto': 0x55,
    };

    if (symbology in symbologies) {
      const bytes = iconv.encode(value, 'ascii');

      this._queue([
        0x1d, 0x68, height,
        0x1d, 0x77, symbology === 'code39' ? 0x02 : 0x03,
      ]);

      if (symbology === 'code128' && bytes[0] !== 0x7b) {
        /* Not yet encodeded Code 128, assume data is Code B, which is similar to ASCII without control chars */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes.length + 2,
          0x7b, 0x42,
          bytes,
        ]);
      } else if (symbologies[symbology] > 0x40) {
        /* Function B symbologies */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes.length,
          bytes,
        ]);
      } else {
        /* Function A symbologies */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes,
          0x00,
        ]);
      }
    } else {
      throw new Error('Symbology not supported by printer');
    }

    return this;
  }

  // QR code
  qrcode(value, model, size, errorlevel) {
    /* Force printing the print buffer and moving to a new line */

    this._queue([
      0x0a,
    ]);

    /* Model */

    const models = {
      1: 0x31,
      2: 0x32,
    };

    if (typeof model === 'undefined') {
      model = 2;
    }

    if (model in models) {
      this._queue([
        0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, models[model], 0x00,
      ]);
    } else {
      throw new Error('Model must be 1 or 2');
    }

    /* Size */

    if (typeof size === 'undefined') {
      size = 6;
    }

    if (typeof size !== 'number') {
      throw new Error('Size must be a number');
    }

    if (size < 1 || size > 8) {
      throw new Error('Size must be between 1 and 8');
    }

    this._queue([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size,
    ]);

    /* Error level */

    const errorlevels = {
      l: 0x30,
      m: 0x31,
      q: 0x32,
      h: 0x33,
    };

    if (typeof errorlevel === 'undefined') {
      errorlevel = 'm';
    }

    if (errorlevel in errorlevels) {
      this._queue([
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, errorlevels[errorlevel],
      ]);
    } else {
      throw new Error('Error level must be l, m, q or h');
    }

    /* Data */

    const bytes = iconv.encode(value, 'iso88591');
    const length = bytes.length + 3;

    this._queue([
      0x1d, 0x28, 0x6b, length % 0xff, length / 0xff, 0x31, 0x50, 0x30, bytes,
    ]);

    /* Print QR code */

    this._queue([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    ]);

    return this;
  }

  // Cut paper
  cut(value) {
    let data = 0x00;

    if (value === 'partial') {
      data = 0x01;
    }

    this._queue([
      0x1d, 0x56, data,
    ]);

    return this;
  }

  // Add raw printer commands
  raw(data) {
    this._queue(data);

    return this;
  }

  // Encode all previous commands
  encode() {
    let length = 0;

    this._buffer.forEach((item) => {
      if (typeof item === 'number') {
        length++;
      } else {
        length += item.length;
      }
    });

    const result = new Uint8Array(length);

    let index = 0;

    this._buffer.forEach((item) => {
      if (typeof item === 'number') {
        result[index] = item;
        index++;
      } else {
        result.set(item, index);
        index += item.length;
      }
    });

    this._reset();

    return result;
  }
}

export default EscPosEncoder;
