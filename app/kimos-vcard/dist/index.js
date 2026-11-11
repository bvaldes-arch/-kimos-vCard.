/*
 * KIMOS vCard (kimos-vcard) — tarjeta de contacto virtual con QR.
 *
 * Edita la tarjeta, la ve en vivo tal como la verá quien escanea, y la
 * publica: el QR apunta a una página pública que sirve el propio KIMOS
 * (asset `card.html` + gateway `public.read`), sin backend a medida.
 *
 *   QR ──► {api}/api/apps/kimos-vcard/asset/card.html?i={instanceId}
 *            └─ lee /api/public/app/{instanceId}/definition  (solo `data`)
 *
 * También exporta la tarjeta como un único HTML autónomo para alojarla en
 * cualquier dominio (figit.ai/bryan, GitHub Pages, Netlify…).
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.0.0';
const APP_ID = 'kimos-vcard';

/*
 * KIMOS vCard — núcleo de la tarjeta (compartido).
 *
 * Este mismo código pinta la tarjeta en TRES lugares, para que lo que ve quien
 * escanea sea exactamente lo que se edita:
 *   1. La vista previa dentro de la app de KIMOS (dist/index.js).
 *   2. La página pública que abre el QR (assets/card.html), servida por KIMOS.
 *   3. La página autónoma exportable (docs/index.html), para alojar donde sea.
 *
 * Sin dependencias de red: íconos SVG y motor QR (qrcode-generator, MIT,
 * Kazuhiko Arase) van embebidos. Todo texto del perfil se pinta como texto
 * (textContent), nunca como HTML.
 */
var KVC = (function () {
  'use strict';

  /* ── Motor QR (qrcode-generator 1.4.4, MIT) ─────────────────────────── */
  var qrcode = (function () {
    //---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    return qrcode;
  })();

  /* ── Íconos: Simple Icons (CC0) para marcas, Lucide (ISC) el resto ──── */
  var ICONS = {"whatsapp":{"fill":true,"els":[["path",{"d":"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"}]]},"linkedin":{"fill":true,"els":[["path",{"d":"M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"}]]},"instagram":{"fill":true,"els":[["path",{"d":"M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"}]]},"mail":{"fill":false,"els":[["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}],["path",{"d":"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"}]]},"globe":{"fill":false,"els":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"}],["path",{"d":"M2 12h20"}]]},"phone":{"fill":false,"els":[["path",{"d":"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"}]]},"map-pin":{"fill":false,"els":[["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]]},"user-plus":{"fill":false,"els":[["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{"cx":"9","cy":"7","r":"4"}],["line",{"x1":"19","x2":"19","y1":"8","y2":"14"}],["line",{"x1":"22","x2":"16","y1":"11","y2":"11"}]]},"share-2":{"fill":false,"els":[["circle",{"cx":"18","cy":"5","r":"3"}],["circle",{"cx":"6","cy":"12","r":"3"}],["circle",{"cx":"18","cy":"19","r":"3"}],["line",{"x1":"8.59","x2":"15.42","y1":"13.51","y2":"17.49"}],["line",{"x1":"15.41","x2":"8.59","y1":"6.51","y2":"10.49"}]]},"download":{"fill":false,"els":[["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["polyline",{"points":"7 10 12 15 17 10"}],["line",{"x1":"12","x2":"12","y1":"15","y2":"3"}]]},"check":{"fill":false,"els":[["path",{"d":"M20 6 9 17l-5-5"}]]},"qr-code":{"fill":false,"els":[["rect",{"width":"5","height":"5","x":"3","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"16","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"3","y":"16","rx":"1"}],["path",{"d":"M21 16h-3a2 2 0 0 0-2 2v3"}],["path",{"d":"M21 21v.01"}],["path",{"d":"M12 7v3a2 2 0 0 1-2 2H7"}],["path",{"d":"M3 12h.01"}],["path",{"d":"M12 3h.01"}],["path",{"d":"M12 16v.01"}],["path",{"d":"M16 12h1"}],["path",{"d":"M21 12v.01"}],["path",{"d":"M12 21v-1"}]]},"chevron-right":{"fill":false,"els":[["path",{"d":"m9 18 6-6-6-6"}]]},"copy":{"fill":false,"els":[["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]]},"moon":{"fill":false,"els":[["path",{"d":"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"}]]},"sun":{"fill":false,"els":[["circle",{"cx":"12","cy":"12","r":"4"}],["path",{"d":"M12 2v2"}],["path",{"d":"M12 20v2"}],["path",{"d":"m4.93 4.93 1.41 1.41"}],["path",{"d":"m17.66 17.66 1.41 1.41"}],["path",{"d":"M2 12h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"m6.34 17.66-1.41 1.41"}],["path",{"d":"m19.07 4.93-1.41 1.41"}]]},"contact":{"fill":false,"els":[["path",{"d":"M16 2v2"}],["path",{"d":"M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"}],["path",{"d":"M8 2v2"}],["circle",{"cx":"12","cy":"11","r":"3"}],["rect",{"x":"3","y":"4","width":"18","height":"18","rx":"2"}]]},"id-card":{"fill":false,"els":[["path",{"d":"M16 10h2"}],["path",{"d":"M16 14h2"}],["path",{"d":"M6.17 15a3 3 0 0 1 5.66 0"}],["circle",{"cx":"9","cy":"11","r":"2"}],["rect",{"x":"2","y":"5","width":"20","height":"14","rx":"2"}]]},"rotate-cw":{"fill":false,"els":[["path",{"d":"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}]]},"repeat":{"fill":false,"els":[["path",{"d":"m17 2 4 4-4 4"}],["path",{"d":"M3 11v-1a4 4 0 0 1 4-4h14"}],["path",{"d":"m7 22-4-4 4-4"}],["path",{"d":"M21 13v1a4 4 0 0 1-4 4H3"}]]},"printer":{"fill":false,"els":[["path",{"d":"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"}],["path",{"d":"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"}],["rect",{"x":"6","y":"14","width":"12","height":"8","rx":"1"}]]},"nfc":{"fill":false,"els":[["path",{"d":"M6 8.32a7.43 7.43 0 0 1 0 7.36"}],["path",{"d":"M9.46 6.21a11.76 11.76 0 0 1 0 11.58"}],["path",{"d":"M12.91 4.1a15.91 15.91 0 0 1 .01 15.8"}],["path",{"d":"M16.37 2a20.16 20.16 0 0 1 0 20"}]]},"upload":{"fill":false,"els":[["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["polyline",{"points":"17 8 12 3 7 8"}],["line",{"x1":"12","x2":"12","y1":"3","y2":"15"}]]},"link":{"fill":false,"els":[["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]]},"external-link":{"fill":false,"els":[["path",{"d":"M15 3h6v6"}],["path",{"d":"M10 14 21 3"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]]},"smartphone":{"fill":false,"els":[["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]]},"monitor":{"fill":false,"els":[["rect",{"width":"20","height":"14","x":"2","y":"3","rx":"2"}],["line",{"x1":"8","x2":"16","y1":"21","y2":"21"}],["line",{"x1":"12","x2":"12","y1":"17","y2":"21"}]]},"eye":{"fill":false,"els":[["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]]},"file-code":{"fill":false,"els":[["path",{"d":"M10 12.5 8 15l2 2.5"}],["path",{"d":"m14 12.5 2 2.5-2 2.5"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}],["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"}]]},"trash-2":{"fill":false,"els":[["path",{"d":"M3 6h18"}],["path",{"d":"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{"d":"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{"x1":"10","x2":"10","y1":"11","y2":"17"}],["line",{"x1":"14","x2":"14","y1":"11","y2":"17"}]]},"image":{"fill":false,"els":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]]},"send":{"fill":false,"els":[["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{"d":"m21.854 2.147-10.94 10.939"}]]}};

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ── Perfil por defecto: Bryan Valdes Ch. · FIGIT.ai ────────────────── */
  var DEFAULT_PROFILE = {
    name: 'Bryan Valdes Ch.',
    firstName: 'Bryan',
    lastName: 'Valdes Chacana',
    title: 'CEO & Fundador',
    company: 'FIGIT.ai',
    tagline: 'Transformando el futuro con Inteligencia Artificial y ecosistemas digitales.',
    phone: '+56 9 8716 1097',
    whatsapp: '56987161097',
    whatsappMsg: 'Hola Bryan, un gusto saludarte. Te contacto desde tu tarjeta digital FIGIT.ai',
    email: 'bvaldes@figit.ai',
    website: 'https://figit.ai',
    linkedin: 'https://www.linkedin.com/in/bryan-vald%C3%A9s-chacana/',
    instagram: 'https://www.instagram.com/figit.ai/',
    address: 'Av. Larraín 5862, Piso 13, La Reina, Santiago, Región Metropolitana',
    city: 'Santiago',
    region: 'Región Metropolitana',
    country: 'Chile',
    photo: 'asset:photo.jpg',
    logo: 'asset:logo-full.png',
    logoMark: 'asset:logo-mark.png',
    logoWord: 'asset:logo-word.png',
    publicUrl: '',
    cardId: 'FIGIT-EXEC-001',
    motto: 'Inteligencia Artificial Estratégica, Modelos Predictivos y Automatización de Alto Impacto.',
    location: 'Santiago, Chile',
    hashtag: '#AIChile',
    font: '',
    brandId: '',
    brandName: '',
    theme: { primary: '#0052FF', ink: '#0D366B', soft: '#DDF0FF', accent: '#00D2FF' }
  };

  var FIELDS = ['name', 'firstName', 'lastName', 'title', 'company', 'tagline', 'phone', 'whatsapp',
    'whatsappMsg', 'email', 'website', 'linkedin', 'instagram', 'address', 'city', 'region', 'country',
    'photo', 'logo', 'logoMark', 'logoWord', 'publicUrl', 'cardId', 'motto', 'location', 'hashtag', 'font', 'brandId', 'brandName'];

  function str(v, max) {
    if (v === null || v === undefined) return '';
    var s = String(v).replace(/[\u0000-\u001f]/g, ' ').trim();
    return s.length > (max || 400) ? s.slice(0, max || 400) : s;
  }
  function isHex(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')); }

  function normalize(p) {
    p = p || {};
    var out = {};
    FIELDS.forEach(function (k) {
      var max = /photo|logo/.test(k) ? 800000 : 400;
      out[k] = p[k] === undefined ? DEFAULT_PROFILE[k] : str(p[k], max);
    });
    out.whatsapp = out.whatsapp.replace(/\D/g, '');
    out.font = out.font.replace(/[^\w \-]/g, '').slice(0, 60);
    var t = p.theme || {};
    out.theme = {};
    Object.keys(DEFAULT_PROFILE.theme).forEach(function (k) {
      out.theme[k] = isHex(t[k]) ? t[k] : DEFAULT_PROFILE.theme[k];
    });
    return out;
  }

  /* ── Enlaces de cada canal ──────────────────────────────────────────── */
  function withProto(u) {
    u = str(u);
    if (!u) return '';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    return 'https://' + u.replace(/^\/+/, '');
  }
  function prettyUrl(u) {
    return str(u).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }
  function igHandle(u) {
    var s = str(u);
    var m = s.match(/instagram\.com\/([^/?#]+)/i);
    if (m) return '@' + m[1];
    return s ? (s.charAt(0) === '@' ? s : '@' + s) : '';
  }
  function igUrl(u) {
    var s = str(u);
    if (!s) return '';
    if (/instagram\.com/i.test(s)) return withProto(s);
    return 'https://www.instagram.com/' + s.replace(/^@/, '') + '/';
  }
  function liLabel(u) {
    var s = str(u);
    var m = s.match(/linkedin\.com\/(in\/[^?#]+)/i);
    var label = m ? m[1].replace(/\/$/, '') : prettyUrl(s);
    try { label = decodeURIComponent(label); } catch (e) { /* tal cual */ }
    return label;
  }

  function links(p) {
    var L = {};
    if (p.whatsapp) {
      L.whatsapp = 'https://wa.me/' + p.whatsapp + (p.whatsappMsg ? '?text=' + encodeURIComponent(p.whatsappMsg) : '');
    }
    var tel = (p.phone || '').replace(/[^\d+]/g, '');
    if (tel) L.phone = 'tel:' + tel;
    if (p.email) L.email = 'mailto:' + p.email + '?subject=' + encodeURIComponent('Contacto desde tu tarjeta digital ' + (p.company || ''));
    if (p.website) L.website = withProto(p.website);
    if (p.linkedin) L.linkedin = withProto(p.linkedin);
    if (p.instagram) L.instagram = igUrl(p.instagram);
    if (p.address) L.maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address);
    return L;
  }

  /* Lista ordenada de canales (WhatsApp primero: es el canal principal). */
  function channels(p) {
    var L = links(p);
    var out = [];
    if (L.whatsapp) out.push({ key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', sub: p.phone || ('+' + p.whatsapp), href: L.whatsapp });
    if (L.email) out.push({ key: 'email', icon: 'mail', label: 'Correo electrónico', sub: p.email, href: L.email });
    if (L.linkedin) out.push({ key: 'linkedin', icon: 'linkedin', label: 'LinkedIn', sub: liLabel(p.linkedin), href: L.linkedin });
    if (L.website) out.push({ key: 'website', icon: 'globe', label: 'Sitio web', sub: prettyUrl(p.website), href: L.website });
    if (L.instagram) out.push({ key: 'instagram', icon: 'instagram', label: 'Instagram', sub: igHandle(p.instagram), href: L.instagram });
    if (L.phone) out.push({ key: 'phone', icon: 'phone', label: 'Llamar', sub: p.phone, href: L.phone });
    if (L.maps) out.push({ key: 'maps', icon: 'map-pin', label: 'Ubicación', sub: p.address, href: L.maps });
    return out;
  }

  /* ── vCard 3.0 (RFC 2426) ───────────────────────────────────────────── */
  function esc(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  function fold(line) {
    // Plegado a 75 octetos aprox. (seguro para base64 de la foto).
    if (line.length <= 75) return line;
    var out = line.slice(0, 75);
    for (var i = 75; i < line.length; i += 74) out += '\r\n ' + line.slice(i, i + 74);
    return out;
  }
  function vcard(p, photoB64) {
    var L = links(p);
    var first = p.firstName || p.name.split(' ')[0] || '';
    var last = p.lastName || p.name.split(' ').slice(1).join(' ');
    var lines = [
      'BEGIN:VCARD', 'VERSION:3.0',
      'N:' + esc(last) + ';' + esc(first) + ';;;',
      'FN:' + esc(p.name)
    ];
    if (p.company) lines.push('ORG:' + esc(p.company));
    if (p.title) lines.push('TITLE:' + esc(p.title));
    if (p.phone) lines.push('TEL;TYPE=CELL,VOICE,PREF:' + p.phone.replace(/[^\d+]/g, ''));
    if (p.email) lines.push('EMAIL;TYPE=INTERNET,WORK,PREF:' + p.email);
    if (L.website) lines.push('URL;TYPE=WORK:' + L.website);
    if (L.linkedin) lines.push('X-SOCIALPROFILE;TYPE=linkedin:' + L.linkedin);
    if (L.instagram) lines.push('X-SOCIALPROFILE;TYPE=instagram:' + L.instagram);
    if (L.whatsapp) lines.push('X-SOCIALPROFILE;TYPE=whatsapp:https://wa.me/' + p.whatsapp);
    if (p.address) lines.push('ADR;TYPE=WORK:;;' + esc(p.address) + ';' + esc(p.city) + ';' + esc(p.region) + ';;' + esc(p.country));
    if (p.tagline) lines.push('NOTE:' + esc(p.tagline));
    if (photoB64) lines.push('PHOTO;ENCODING=b;TYPE=JPEG:' + photoB64);
    lines.push('END:VCARD');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /* ── QR ─────────────────────────────────────────────────────────────── */
  function qrMatrix(text, ec) {
    var q = qrcode(0, ec || 'Q');
    q.addData(text, 'Byte');
    q.make();
    var n = q.getModuleCount();
    var m = [];
    for (var r = 0; r < n; r++) { var row = []; for (var c = 0; c < n; c++) row.push(q.isDark(r, c)); m.push(row); }
    return m;
  }

  /* Un QR solo vale si abre algo REAL en otro teléfono: https público.
     Se rechazan blob:, file:, data:, localhost y redes locales, que en la
     pantalla de quien lo genera funcionan y en la cámara de otro no. */
  function checkQrUrl(u) {
    var s = str(u, 2000);
    if (!s) return { ok: false, reason: 'Falta el enlace de destino.' };
    var url;
    try { url = new URL(s); } catch (e) { return { ok: false, reason: 'No es un enlace válido (debe empezar por https://).' }; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'Un enlace ' + url.protocol + ' solo existe en este equipo: usa una dirección https:// pública.' };
    var host = url.hostname;
    if (!host || /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /\.local$/.test(host)) {
      return { ok: false, reason: 'Ese enlace es local (' + host + '): otro teléfono no puede abrirlo.' };
    }
    if (host.indexOf('.') < 0) return { ok: false, reason: 'Al dominio le falta la extensión (.com, .ai…).' };
    if (url.protocol === 'http:') return { ok: true, url: url.href, warn: 'Funciona, pero conviene https:// (los teléfonos avisan «sitio no seguro»).' };
    return { ok: true, url: url.href };
  }

  /* SVG del QR: módulos en un solo <path>, ojos redondeados y hueco central
     para el isotipo (nivel Q = 25 % de corrección: el logo tapa < 8 %). */
  function qrSvg(text, opt) {
    opt = opt || {};
    var m = qrMatrix(text, opt.ec || 'Q');
    var n = m.length, quiet = 2, size = n + quiet * 2;
    var hole = opt.logo ? Math.floor(n * 0.24) | 1 : 0;
    var h0 = Math.floor((n - hole) / 2), h1 = h0 + hole;
    function inEye(r, c) {
      return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    }
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!m[r][c] || inEye(r, c)) continue;
        if (hole && r >= h0 && r < h1 && c >= h0 && c < h1) continue;
        d += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Código QR: ' + text);
    var bg = document.createElementNS(SVGNS, 'rect');
    bg.setAttribute('width', size); bg.setAttribute('height', size); bg.setAttribute('fill', opt.light || '#FFFFFF');
    svg.appendChild(bg);
    var path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', d); path.setAttribute('fill', opt.dark || '#0C364F');
    svg.appendChild(path);
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(function (pos) {
      var y = pos[0] + quiet, x = pos[1] + quiet;
      var o = document.createElementNS(SVGNS, 'rect');
      o.setAttribute('x', x + 0.5); o.setAttribute('y', y + 0.5); o.setAttribute('width', 6); o.setAttribute('height', 6);
      o.setAttribute('rx', 1.6); o.setAttribute('fill', 'none'); o.setAttribute('stroke', opt.eye || opt.dark || '#0C364F');
      o.setAttribute('stroke-width', 1);
      svg.appendChild(o);
      var i = document.createElementNS(SVGNS, 'rect');
      i.setAttribute('x', x + 2); i.setAttribute('y', y + 2); i.setAttribute('width', 3); i.setAttribute('height', 3);
      i.setAttribute('rx', 0.8); i.setAttribute('fill', opt.eye || opt.dark || '#0C364F');
      svg.appendChild(i);
    });
    if (hole && opt.logo) {
      var pad = document.createElementNS(SVGNS, 'rect');
      pad.setAttribute('x', h0 + quiet + 0.3); pad.setAttribute('y', h0 + quiet + 0.3);
      pad.setAttribute('width', hole - 0.6); pad.setAttribute('height', hole - 0.6);
      pad.setAttribute('rx', hole * 0.22); pad.setAttribute('fill', opt.light || '#FFFFFF');
      svg.appendChild(pad);
      var img = document.createElementNS(SVGNS, 'image');
      var inset = hole * 0.16;
      img.setAttribute('x', h0 + quiet + inset); img.setAttribute('y', h0 + quiet + inset);
      img.setAttribute('width', hole - inset * 2); img.setAttribute('height', hole - inset * 2);
      img.setAttribute('href', opt.logo);
      img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.appendChild(img);
    }
    return svg;
  }

  /* ── DOM helpers ────────────────────────────────────────────────────── */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var ch = arguments[i];
      if (ch === null || ch === undefined || ch === false) continue;
      if (Array.isArray(ch)) ch.forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      else el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
    }
    return el;
  }
  function icon(name, cls) {
    var spec = ICONS[name];
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'kvc-i' + (cls ? ' ' + cls : ''));
    if (!spec) return svg;
    if (spec.fill) svg.setAttribute('fill', 'currentColor');
    else {
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    }
    spec.els.forEach(function (e) {
      var node = document.createElementNS(SVGNS, e[0]);
      Object.keys(e[1]).forEach(function (k) { node.setAttribute(k, e[1][k]); });
      svg.appendChild(node);
    });
    return svg;
  }

  function resolveImg(src, resolver) {
    if (!src) return '';
    if (src.indexOf('asset:') === 0) return resolver ? resolver(src.slice(6)) : src.slice(6);
    return src;
  }

  function download(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function imgToB64(url) {
    if (!url) return Promise.resolve('');
    if (url.indexOf('data:') === 0) {
      return Promise.resolve(/^data:image\/jpe?g/.test(url) ? url.split(',')[1] : '').then(function (b) {
        return b || rasterB64(url);
      });
    }
    return rasterB64(url);
  }
  // Re-codifica a JPEG 320 px (lo que aceptan iOS y Android en PHOTO).
  function rasterB64(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var s = 320, c = document.createElement('canvas'); c.width = s; c.height = s;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
          var r = Math.max(s / img.naturalWidth, s / img.naturalHeight);
          var w = img.naturalWidth * r, hh = img.naturalHeight * r;
          g.drawImage(img, (s - w) / 2, (s - hh) / 2, w, hh);
          resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
        } catch (e) { resolve(''); }
      };
      img.onerror = function () { resolve(''); };
      img.src = url;
    });
  }

  function slug(s) {
    return String(s || 'contacto').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  function saveVcf(p, resolver) {
    return imgToB64(resolveImg(p.photo, resolver)).then(function (b64) {
      var text = vcard(p, b64);
      download(slug(p.name) + '.vcf', new Blob([text], { type: 'text/vcard;charset=utf-8' }));
      return text;
    });
  }

  /* QR a PNG (para imprimir o fondo de pantalla). */
  function qrPng(text, opt) {
    opt = opt || {};
    var svg = qrSvg(text, opt);
    var px = opt.px || 1200;
    var xml = new XMLSerializer().serializeToString(svg);
    return new Promise(function (resolve, reject) {
      // El isotipo va como data: para que el canvas no quede «tainted».
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = px; c.height = px;
        var g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, px, px);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('PNG')); }, 'image/png');
      };
      img.onerror = function () { reject(new Error('No se pudo rasterizar el QR')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }

  /* ── La tarjeta: Hub · Tarjeta 3D · Código QR ─────────────────────────── */
  /*
   * mount(root, profile, opts) pinta la interfaz completa dentro de `root`.
   * opts.qrUrl     destino del QR (si falta: profile.publicUrl o location.href)
   * opts.resolve   (nombre) → URL, para las imágenes 'asset:…'
   * opts.preview   true dentro de la app de KIMOS (sin imprimir ni compartir nativo)
   * opts.view      vista inicial: 'hub' (por defecto) | 'card' | 'qr'
   * opts.storage   false para no recordar el tema en localStorage
   */
  var HUB_TITLES = {
    whatsapp: 'Chatear por WhatsApp', email: 'Enviar Correo Directo', linkedin: 'Perfil en LinkedIn',
    website: 'Sitio Web Oficial', instagram: 'Instagram Oficial', phone: 'Llamar por Teléfono', maps: 'Ubicación en Google Maps'
  };

  function mount(root, profile, opts) {
    opts = opts || {};
    var p = normalize(profile);
    var R = function (s) { return resolveImg(s, opts.resolve); };
    var here = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
    var baseQr = [opts.qrUrl, p.publicUrl, here, links(p).website].filter(function (u) { return u && checkQrUrl(u).ok; })[0] || 'https://figit.ai';
    var qrUrl = baseQr;
    var ch = channels(p);
    var L = links(p);
    var dark = false;
    try { dark = opts.storage !== false && localStorage.getItem('kvc-theme') === 'dark'; } catch (e) { /* sin storage */ }
    var view = opts.view === 'card' || opts.view === 'qr' ? opts.view : 'hub';
    var cleanups = [];

    /* Avisos */
    var toastEl = h('div', { class: 'kvc-toast', role: 'status', 'aria-live': 'polite' });
    var toastT = null;
    function toast(t) {
      toastEl.textContent = t; toastEl.classList.add('kvc-on');
      clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('kvc-on'); }, 2600);
    }
    function a(href, cls, attrs, children) {
      var o = { href: href, class: cls, target: /^https?:/.test(href) ? '_blank' : null, rel: 'noopener noreferrer' };
      Object.keys(attrs || {}).forEach(function (k) { o[k] = attrs[k]; });
      return h('a', o, children);
    }
    function copy(text, ok) {
      var done = function () { toast(ok || 'Copiado'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast(text); });
      else toast(text);
    }

    /* Acciones */
    function onSave() {
      saveVcf(p, opts.resolve).then(function () { toast('Contacto descargado: ábrelo para guardarlo en tu agenda.'); });
    }
    function logoData() {
      var src = R(p.logoMark);
      if (!src || src.indexOf('data:') === 0) return Promise.resolve(src);
      return fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
      }).catch(function () { return ''; });
    }
    function onQrPng() {
      logoData().then(function (logo) { return qrPng(qrUrl, { dark: p.theme.ink, logo: logo, px: 1400 }); })
        .then(function (b) { download('QR_' + slug(p.name) + '.png', b); toast('QR descargado en alta resolución'); })
        .catch(function () { toast('No se pudo generar el PNG'); });
    }
    function onShare() {
      var data = { title: p.name + ' · ' + p.company, text: 'Te comparto mi tarjeta de contacto digital.', url: qrUrl };
      if (navigator.share && !opts.preview) { navigator.share(data).catch(function () { }); return; }
      openModal(shareModal());
    }

    /* Modales */
    var modalHost = h('div', { class: 'kvc-modal-host' });
    function openModal(content) {
      var close = function () { modalHost.replaceChildren(); };
      var box = h('div', { class: 'kvc-modal', role: 'dialog', 'aria-modal': 'true' },
        h('button', { type: 'button', class: 'kvc-modal-x', 'aria-label': 'Cerrar', on: { click: close } }, '×'),
        content);
      var back = h('div', { class: 'kvc-backdrop', on: { click: function (e) { if (e.target === back) close(); } } }, box);
      modalHost.replaceChildren(back);
    }
    function shareModal() {
      var msg = 'Hola, te comparto la tarjeta digital de ' + p.name + ' (' + p.title + ', ' + p.company + '): ' + qrUrl;
      var opt = function (href, icn, cls, label) {
        return a(href, 'kvc-share-opt ' + cls, null, [h('span', { class: 'kvc-share-ic' }, icon(icn)), h('span', { text: label })]);
      };
      return h('div', null,
        h('h3', { class: 'kvc-modal-t', text: 'Compartir tarjeta' }),
        h('p', { class: 'kvc-modal-s', text: 'Envía tu tarjeta digital por el canal que prefieras.' }),
        h('div', { class: 'kvc-share-grid' },
          opt('https://wa.me/?text=' + encodeURIComponent(msg), 'whatsapp', 'kvc-c-whatsapp', 'WhatsApp'),
          opt('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(qrUrl), 'linkedin', 'kvc-c-linkedin', 'LinkedIn'),
          opt('mailto:?subject=' + encodeURIComponent('Tarjeta digital · ' + p.name) + '&body=' + encodeURIComponent(msg), 'mail', 'kvc-c-email', 'Correo'),
          h('button', { type: 'button', class: 'kvc-share-opt kvc-c-qr', on: { click: function () { modalHost.replaceChildren(); setView('qr'); } } },
            h('span', { class: 'kvc-share-ic' }, icon('qr-code')), h('span', { text: 'Código QR' }))),
        h('div', { class: 'kvc-copy' },
          h('input', { class: 'kvc-input', value: qrUrl, readonly: true, 'aria-label': 'Enlace de la tarjeta' }),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(qrUrl, 'Enlace copiado'); } } }, icon('copy'), h('span', { text: 'Copiar' }))));
    }
    function vcardModal() {
      var text = vcard(p, '');
      return h('div', null,
        h('h3', { class: 'kvc-modal-t', text: 'Datos de contacto (vCard 3.0)' }),
        h('pre', { class: 'kvc-pre', text: text }),
        h('div', { class: 'kvc-modal-actions' },
          h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onSave } }, icon('download'), h('span', { text: 'Descargar .vcf' })),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(text, 'vCard copiada'); } } }, icon('copy'), h('span', { text: 'Copiar' }))));
    }

    /* QR (se repinta si cambia el destino en el estudio) */
    var qrSlots = [];
    function qrSlot(cls, withLogo) {
      var el = h('div', { class: 'kvc-qr-slot ' + (cls || '') });
      qrSlots.push({ el: el, logo: withLogo });
      return el;
    }
    function paintQr() {
      qrSlots.forEach(function (s) {
        try { s.el.replaceChildren(qrSvg(qrUrl, { dark: p.theme.ink, logo: s.logo ? R(p.logoMark) : '' })); }
        catch (e) { s.el.textContent = 'Enlace demasiado largo para un QR'; }
      });
    }

    /* ── Cabecera ── */
    var tabs = {};
    function tab(id, icn, label) {
      tabs[id] = h('button', { type: 'button', class: 'kvc-tab', 'data-v': id, on: { click: function () { setView(id); } } },
        icon(icn), h('span', { class: 'kvc-tab-t', text: label }));
      return tabs[id];
    }
    var themeBtn = h('button', { type: 'button', class: 'kvc-ibtn', title: 'Cambiar tema', 'aria-label': 'Cambiar tema' }, icon(dark ? 'sun' : 'moon'));
    var header = h('header', { class: 'kvc-head' },
      h('div', { class: 'kvc-head-in' },
        h('button', { type: 'button', class: 'kvc-head-brand', on: { click: function () { setView('hub'); } } },
          h('span', { class: 'kvc-head-logo' },
            p.logoMark ? h('img', { src: R(p.logoMark), alt: '', class: 'kvc-head-mark' }) : null,
            p.logoWord ? h('img', { src: R(p.logoWord), alt: p.company, class: 'kvc-head-word' })
              : (p.logoMark && p.logoMark === p.logo ? null : h('strong', { class: 'kvc-head-co', text: p.company }))),
          h('span', { class: 'kvc-head-meta' },
            h('span', { class: 'kvc-badge', text: 'Oficial' }),
            h('span', { class: 'kvc-head-sub', text: 'Tarjeta de Contacto Ejecutiva' }))),
        h('div', { class: 'kvc-head-actions' },
          h('nav', { class: 'kvc-tabs', 'aria-label': 'Vistas' },
            tab('hub', 'contact', 'Hub'), tab('card', 'id-card', 'Tarjeta 3D'), tab('qr', 'qr-code', 'Código QR')),
          h('button', { type: 'button', class: 'kvc-ibtn', title: 'Compartir tarjeta', 'aria-label': 'Compartir', on: { click: onShare } }, icon('share-2')),
          themeBtn)));

    /* ── Vista 1: Hub ── */
    var hubList = ch.map(function (c) {
      return a(c.href, 'kvc-hl kvc-c-' + c.key + (c.key === 'whatsapp' ? ' kvc-hl-main' : ''), null, [
        h('span', { class: 'kvc-hl-ic' }, icon(c.icon)),
        h('span', { class: 'kvc-hl-txt' },
          h('strong', null, HUB_TITLES[c.key] || c.label, c.key === 'whatsapp' ? h('em', { class: 'kvc-chip-main', text: 'Principal' }) : null),
          h('small', { text: c.sub })),
        h('span', { class: 'kvc-hl-go' }, icon('chevron-right'))]);
    });
    var pills = [];
    if (L.phone) pills.push(a(L.phone, 'kvc-pill kvc-c-phone', null, [icon('phone'), h('span', { text: 'Llamar' })]));
    if (L.whatsapp) pills.push(a(L.whatsapp, 'kvc-pill kvc-pill-wa kvc-c-whatsapp', null, [icon('whatsapp'), h('span', { text: 'WhatsApp' })]));
    if (L.email) pills.push(a(L.email, 'kvc-pill kvc-c-email', null, [icon('mail'), h('span', { text: 'Email' })]));

    var hub = h('section', { class: 'kvc-view kvc-hub', 'data-view': 'hub' },
      h('div', { class: 'kvc-panel' },
        h('div', { class: 'kvc-panel-bar' }),
        h('div', { class: 'kvc-profile' },
          h('div', { class: 'kvc-avatar' },
            h('div', { class: 'kvc-avatar-ring' },
              p.photo ? h('img', { src: R(p.photo), alt: p.name, class: 'kvc-avatar-img' })
                : h('div', { class: 'kvc-avatar-ph', text: (p.name || '?').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('') })),
            h('span', { class: 'kvc-verified', title: 'Perfil verificado' }, icon('check'))),
          h('h1', { class: 'kvc-name', text: p.name }),
          h('div', { class: 'kvc-role' },
            h('span', { class: 'kvc-dot' }),
            h('span', { class: 'kvc-title', text: p.title }),
            p.company ? h('span', { class: 'kvc-sep', text: '|' }) : null,
            p.company ? h('span', { class: 'kvc-company', text: p.company }) : null),
          p.tagline ? h('p', { class: 'kvc-tagline', text: p.tagline }) : null,
          h('button', { type: 'button', class: 'kvc-save', on: { click: onSave } },
            icon('user-plus', 'kvc-bounce'), h('span', { text: 'Guardar Contacto en el Teléfono' }), h('span', { class: 'kvc-save-chip', text: 'vCard .VCF' })),
          pills.length ? h('div', { class: 'kvc-pills' }, pills) : null),
        h('div', { class: 'kvc-divider' }, h('span', { text: 'Canales Oficiales' })),
        h('div', { class: 'kvc-hlist' }, hubList),
        h('div', { class: 'kvc-mini' },
          h('button', { type: 'button', class: 'kvc-mini-qr', 'aria-label': 'Ver código QR', on: { click: function () { setView('qr'); } } }, qrSlot('', false)),
          h('div', { class: 'kvc-mini-txt' },
            h('strong', { text: 'Código QR Dinámico' }),
            h('small', { text: 'Escanea para compartir o abrir en otro celular' })),
          h('button', { type: 'button', class: 'kvc-mini-btn', on: { click: function () { setView('qr'); } } }, 'Ver QR')),
        h('div', { class: 'kvc-powered' },
          h('div', null, h('span', { text: 'Impulsado por ' }), h('strong', { text: p.company || 'KIMOS' })),
          h('small', { text: 'Ecosistema de Tarjetas Digitales Inteligentes' }))));

    /* ── Vista 2: Tarjeta 3D ── */
    var rowsDef = [
      L.phone && ['phone', 'phone', p.phone, L.phone],
      L.email && ['email', 'mail', p.email, L.email],
      L.website && ['website', 'globe', prettyUrl(p.website), L.website],
      L.maps && ['maps', 'map-pin', p.address, L.maps],
      L.linkedin && ['linkedin', 'linkedin', liLabel(p.linkedin), L.linkedin],
      L.instagram && ['instagram', 'instagram', igHandle(p.instagram), L.instagram]
    ].filter(Boolean);
    var card3d = h('div', { class: 'kvc-c3d' },
      h('div', { class: 'kvc-face kvc-front' },
        h('div', { class: 'kvc-front-side' },
          h('div', { class: 'kvc-front-avatar' }, p.photo ? h('img', { src: R(p.photo), alt: p.name }) : null),
          p.logo ? h('div', { class: 'kvc-front-logo' }, h('img', { src: R(p.logo), alt: p.company })) : null,
          h('div', { class: 'kvc-front-qr' }, qrSlot('kvc-front-qrbox', false), h('span', { text: 'Escanear contacto' }))),
        h('div', { class: 'kvc-front-main' },
          h('div', null,
            h('h2', { class: 'kvc-front-name', text: p.name }),
            h('p', { class: 'kvc-front-title', text: p.title.replace(/\s*&\s*/g, ' - ') }),
            h('p', { class: 'kvc-front-co', text: p.company }),
            h('div', { class: 'kvc-front-rule' })),
          h('div', { class: 'kvc-front-rows' }, rowsDef.map(function (r) {
            return a(r[3], 'kvc-fr kvc-c-' + r[0], { on: null }, [h('span', { class: 'kvc-fr-ic' }, icon(r[1])), h('span', { class: 'kvc-fr-t', text: r[2] })]);
          })),
          h('div', { class: 'kvc-front-foot' }, h('span', { text: 'ID: ' + (p.cardId || slug(p.name).toUpperCase()) }), h('strong', { text: (p.company || 'KIMOS') + ' Ecosystem' }))),
        h('div', { class: 'kvc-sheen' })),
      h('div', { class: 'kvc-face kvc-back' },
        h('div', { class: 'kvc-back-top' },
          h('div', { class: 'kvc-chipset' }, h('span', { class: 'kvc-chip' }), icon('nfc', 'kvc-nfc')),
          h('div', { class: 'kvc-back-pass' }, h('span', { text: 'Verified Executive Pass' }), h('i', { class: 'kvc-live' }))),
        h('div', { class: 'kvc-back-mid' },
          p.logo ? h('div', { class: 'kvc-back-logo' }, h('img', { src: R(p.logo), alt: p.company })) : null,
          p.motto ? h('p', { text: p.motto }) : null),
        h('div', { class: 'kvc-back-foot' },
          h('span', { text: p.location || p.city }),
          h('span', null, h('strong', { text: prettyUrl(p.website) }), p.hashtag ? h('em', { text: p.hashtag }) : null)),
        h('div', { class: 'kvc-sheen' })));
    var flipped = false;
    function flip() { flipped = !flipped; card3d.classList.toggle('kvc-flipped', flipped); }
    var scene = h('div', { class: 'kvc-scene', on: { click: function (e) { if (!e.target.closest('a')) flip(); } } }, card3d);
    var cardView = h('section', { class: 'kvc-view kvc-cardview', 'data-view': 'card' },
      h('div', { class: 'kvc-flipbar' },
        h('span', null, icon('rotate-cw'), h('span', { text: 'Haz clic para voltear la tarjeta' })),
        h('button', { type: 'button', class: 'kvc-btn-xs', on: { click: flip } }, icon('repeat'), h('span', { text: 'Voltear' }))),
      scene,
      h('div', { class: 'kvc-card-actions' },
        h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onSave } }, icon('download'), h('span', { text: 'Descargar Contacto (vCard)' })),
        opts.preview ? null : h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { window.print(); } } }, icon('printer'), h('span', { text: 'Imprimir Tarjeta' })),
        h('button', { type: 'button', class: 'kvc-btn-s', on: { click: onShare } }, icon('share-2'), h('span', { text: 'Compartir' }))));

    /* ── Vista 3: Código QR ── */
    var urlInput = h('input', { class: 'kvc-input kvc-mono', value: qrUrl, 'aria-label': 'Enlace de destino del QR', spellcheck: 'false' });
    var urlMsg = h('small', { class: 'kvc-field-err' });
    urlInput.addEventListener('input', function () {
      var v = urlInput.value.trim();
      var c = checkQrUrl(v || baseQr);
      urlMsg.textContent = c.ok ? (c.warn || '') : c.reason + ' El QR sigue apuntando a ' + qrUrl;
      if (c.ok) { qrUrl = v || baseQr; paintQr(); }
    });
    var qrView = h('section', { class: 'kvc-view kvc-qrview', 'data-view': 'qr' },
      h('div', { class: 'kvc-panel kvc-panel-qr' },
        h('span', { class: 'kvc-kicker' }, icon('qr-code'), h('span', { text: 'Generador Dinámico ' + (p.company.replace(/\.ai$/i, '').toUpperCase() || 'KIMOS') })),
        h('h2', { class: 'kvc-qr-title', text: 'Código QR Oficial' }),
        h('p', { class: 'kvc-qr-sub', text: 'Apunta la cámara de cualquier teléfono para abrir instantáneamente la tarjeta virtual y canales de contacto.' }),
        h('div', { class: 'kvc-qr-frame' }, h('div', { class: 'kvc-qr-white' }, qrSlot('kvc-qr-big', true))),
        h('div', { class: 'kvc-field' },
          h('label', null, h('span', { text: 'Enlace de Destino del QR:' }), h('em', { text: '100% Dinámico' })),
          h('div', { class: 'kvc-field-row' }, urlInput,
            h('button', { type: 'button', class: 'kvc-reset', title: 'Restablecer enlace original', on: { click: function () { urlInput.value = baseQr; qrUrl = baseQr; paintQr(); } } }, 'Actual')),
          urlMsg,
          h('small', { text: 'Puedes personalizar el enlace a tu propio dominio si lo requieres. Solo se aceptan direcciones https:// públicas.' })),
        h('div', { class: 'kvc-qr-actions' },
          h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onQrPng } }, icon('download'), h('span', { text: 'Descargar PNG HD' })),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(qrUrl, 'Enlace copiado'); } } }, icon('copy'), h('span', { text: 'Copiar Enlace' })))));

    /* ── Pie ── */
    var footer = h('footer', { class: 'kvc-foot' },
      h('div', { class: 'kvc-foot-in' },
        h('p', { text: '© ' + new Date().getFullYear() + ' ' + (p.company || '') + ' • ' + p.name + '. Todos los derechos reservados.' }),
        h('div', { class: 'kvc-foot-links' },
          L.website ? a(L.website, '', null, [prettyUrl(p.website)]) : null,
          L.linkedin ? h('span', { text: '•' }) : null,
          L.linkedin ? a(L.linkedin, '', null, ['LinkedIn']) : null,
          h('span', { text: '•' }),
          h('button', { type: 'button', on: { click: function () { openModal(vcardModal()); } } }, 'Ver Datos vCard'))));

    var bg = h('div', { class: 'kvc-bg', 'aria-hidden': 'true' }, contour('kvc-bg-a', 5), contour('kvc-bg-b', 3));
    var wrap = h('div', {
      class: 'kvc' + (dark ? ' kvc-dark' : '') + (opts.preview ? ' kvc-preview' : ''),
      style: '--kvc-primary:' + p.theme.primary + ';--kvc-ink:' + p.theme.ink + ';--kvc-soft:' + p.theme.soft + ';--kvc-accent:' + p.theme.accent +
        (p.font ? ';font-family:"' + p.font + '","Plus Jakarta Sans",Inter,-apple-system,"Segoe UI",Roboto,sans-serif' : '')
    }, bg, header, h('main', { class: 'kvc-body' }, hub, cardView, qrView), footer, modalHost, toastEl);

    function setView(v) {
      view = v;
      [hub, cardView, qrView].forEach(function (s) { s.hidden = s.getAttribute('data-view') !== v; });
      Object.keys(tabs).forEach(function (k) { tabs[k].classList.toggle('kvc-tab-on', k === v); tabs[k].setAttribute('aria-pressed', k === v ? 'true' : 'false'); });
    }
    themeBtn.addEventListener('click', function () {
      dark = !dark;
      wrap.classList.toggle('kvc-dark', dark);
      themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
      try { if (opts.storage !== false) localStorage.setItem('kvc-theme', dark ? 'dark' : 'light'); } catch (e) { /* sin storage */ }
    });
    function onKey(e) { if (e.key === 'Escape') modalHost.replaceChildren(); }
    document.addEventListener('keydown', onKey);
    cleanups.push(function () { document.removeEventListener('keydown', onKey); });

    setView(view);
    paintQr();
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(wrap);
    return {
      qrUrl: function () { return qrUrl; },
      profile: p,
      setView: setView,
      destroy: function () { cleanups.forEach(function (f) { f(); }); clearTimeout(toastT); }
    };
  }

  /* Contornos de fondo (la «huella» de la marca). */
  function contour(cls, n) {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 600 600');
    svg.setAttribute('class', cls);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    for (var i = 0; i < n; i++) {
      var o = i * 20, y = 100 + i * 30;
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', 'M' + (50 + o) + ' 300 C ' + (150 + o / 2) + ' ' + y + ', ' + (350 - o / 2) + ' ' + y + ', ' + (550 - o) + ' 300 C ' + (450 - o) + ' ' + (600 - y) + ', ' + (250 + o / 2) + ' ' + (600 - y) + ', ' + (50 + o) + ' 300');
      path.setAttribute('stroke-width', String(1.5 - i * 0.2));
      svg.appendChild(path);
    }
    return svg;
  }

  /* ── Estilos de la tarjeta (todo bajo .kvc) ─────────────────────────── */
  var CSS = "/* KIMOS vCard — interfaz de la tarjeta (Hub · Tarjeta 3D · Código QR).\n   Todo bajo .kvc. Los colores son tokens con nombre: marca FIGIT por\n   defecto y re-definibles por perfil (--kvc-primary/ink/soft/accent). */\n.kvc {\n  --kvc-primary: #0052FF;\n  --kvc-ink: #0D366B;\n  --kvc-soft: #DDF0FF;\n  --kvc-accent: #00D2FF;\n  --kvc-primary-2: color-mix(in srgb, var(--kvc-primary) 82%, #000);\n  --kvc-page: #F8FAFC;\n  --kvc-surface: #FFFFFF;\n  --kvc-head: rgba(255, 255, 255, .82);\n  --kvc-text: #0F172A;\n  --kvc-text-2: #334155;\n  --kvc-muted: #64748B;\n  --kvc-faint: #94A3B8;\n  --kvc-line: #E2E8F0;\n  --kvc-tile: #F8FAFC;\n  --kvc-pill: #F1F5F9;\n  --kvc-tint: #EDF5FF;\n  --kvc-wa: #10B981;\n  --kvc-wa-brand: #25D366;\n  --kvc-li: #0284C7;\n  --kvc-web: #4F46E5;\n  --kvc-ig: #DB2777;\n  --kvc-ig-1: #F59E0B;\n  --kvc-map: #E11D48;\n  --kvc-tel: #E53E3E;\n  --kvc-mail: var(--kvc-primary);\n  --kvc-on: #FFFFFF;\n  --kvc-shadow: 0 20px 45px -15px rgba(0, 36, 128, .14);\n  --kvc-glow: 0 0 25px -5px color-mix(in srgb, var(--kvc-primary) 50%, transparent);\n  position: relative;\n  min-height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  container-type: inline-size;\n  background: var(--kvc-page);\n  color: var(--kvc-text);\n  font-family: \"Plus Jakarta Sans\", Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;\n  -webkit-font-smoothing: antialiased;\n  -webkit-tap-highlight-color: transparent;\n  line-height: 1.4;\n  transition: background .3s, color .3s;\n}\n.kvc.kvc-dark {\n  --kvc-page: #070C18;\n  --kvc-surface: #0D162B;\n  --kvc-head: rgba(8, 14, 30, .82);\n  --kvc-text: #F1F5F9;\n  --kvc-text-2: #CBD5E1;\n  --kvc-muted: #94A3B8;\n  --kvc-faint: #64748B;\n  --kvc-line: #1E293B;\n  --kvc-tile: rgba(30, 41, 59, .5);\n  --kvc-pill: rgba(30, 41, 59, .8);\n  --kvc-tint: rgba(7, 22, 73, .45);\n  --kvc-li: #38BDF8;\n  --kvc-web: #818CF8;\n  --kvc-ig: #F472B6;\n  --kvc-mail: var(--kvc-accent);\n  --kvc-shadow: 0 25px 50px -12px rgba(0, 0, 0, .55);\n}\n.kvc *, .kvc *::before, .kvc *::after { box-sizing: border-box; }\n.kvc [hidden] { display: none !important; }\n.kvc a { color: inherit; text-decoration: none; }\n.kvc button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }\n.kvc .kvc-i { width: 1em; height: 1em; flex: none; display: block; }\n.kvc img { display: block; }\n\n/* Fondo: contornos y patrón de puntos */\n.kvc .kvc-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; opacity: .4; z-index: 0;\n  background-image: radial-gradient(color-mix(in srgb, var(--kvc-primary) 8%, transparent) 1px, transparent 1px); background-size: 24px 24px; }\n.kvc.kvc-dark .kvc-bg { opacity: .25; }\n.kvc .kvc-bg-a { position: absolute; right: -144px; top: -144px; width: 650px; height: 650px; color: var(--kvc-primary); opacity: .2; }\n.kvc .kvc-bg-b { position: absolute; left: -192px; bottom: -192px; width: 700px; height: 700px; color: var(--kvc-accent); opacity: .25; }\n.kvc > *:not(.kvc-bg) { position: relative; z-index: 1; }\n\n/* ── Cabecera ─────────────────────────────────────────────────────────── */\n.kvc .kvc-head { position: sticky; top: 0; z-index: 40; background: var(--kvc-head); border-bottom: 1px solid var(--kvc-line);\n  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }\n.kvc.kvc-preview .kvc-head { position: relative; }\n.kvc .kvc-head-in { max-width: 896px; margin: 0 auto; padding: 0 16px; height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n.kvc .kvc-head-brand { display: flex; align-items: center; gap: 10px; min-width: 0; text-align: left; }\n.kvc .kvc-head-logo { height: 40px; display: flex; align-items: center; gap: 6px; background: #FFFFFF; padding: 4px 8px 4px 6px; border-radius: 10px; border: 1px solid var(--kvc-line); }\n.kvc .kvc-head-mark { height: 28px; width: auto; }\n.kvc .kvc-head-word { height: 13px; width: auto; }\n.kvc .kvc-head-meta { display: flex; flex-direction: column; gap: 2px; }\n.kvc .kvc-badge { align-self: flex-start; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 1px 6px; border-radius: 5px;\n  background: var(--kvc-tint); color: var(--kvc-primary); border: 1px solid color-mix(in srgb, var(--kvc-primary) 25%, transparent); }\n.kvc.kvc-dark .kvc-badge { color: var(--kvc-accent); }\n.kvc .kvc-head-sub { font-size: 10px; color: var(--kvc-muted); display: none; }\n.kvc .kvc-head-actions { display: flex; align-items: center; gap: 6px; }\n.kvc .kvc-tabs { display: flex; padding: 4px; gap: 2px; border-radius: 12px; background: var(--kvc-pill); border: 1px solid var(--kvc-line); }\n.kvc .kvc-tab { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--kvc-text-2); transition: all .2s; }\n.kvc .kvc-tab .kvc-i { font-size: 14px; }\n.kvc .kvc-tab:hover { color: var(--kvc-primary); }\n.kvc .kvc-tab.kvc-tab-on { color: var(--kvc-on); background: var(--kvc-primary); box-shadow: 0 2px 8px -2px color-mix(in srgb, var(--kvc-primary) 60%, transparent); }\n.kvc .kvc-tab-t { display: none; }\n.kvc .kvc-ibtn { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; font-size: 15px; background: var(--kvc-pill); border: 1px solid var(--kvc-line); color: var(--kvc-text-2); transition: color .2s; }\n.kvc .kvc-ibtn:hover { color: var(--kvc-primary); }\n\n/* ── Cuerpo y vistas ──────────────────────────────────────────────────── */\n.kvc .kvc-body { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px 14px 32px; }\n.kvc .kvc-view { width: 100%; animation: kvc-in .45s cubic-bezier(.2, .8, .2, 1) both; }\n@keyframes kvc-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }\n.kvc .kvc-hub, .kvc .kvc-qrview { max-width: 448px; }\n.kvc .kvc-panel { position: relative; overflow: hidden; padding: 26px 22px 22px; border-radius: 24px; background: var(--kvc-surface); border: 1px solid var(--kvc-line); box-shadow: var(--kvc-shadow); }\n.kvc .kvc-panel-bar { position: absolute; inset: 0 0 auto 0; height: 6px; background: linear-gradient(90deg, var(--kvc-primary), var(--kvc-accent), var(--kvc-primary-2)); }\n\n/* Hub · perfil */\n.kvc .kvc-profile { display: flex; flex-direction: column; align-items: center; text-align: center; }\n.kvc .kvc-avatar { position: relative; margin-bottom: 16px; }\n.kvc .kvc-avatar-ring { width: 128px; height: 128px; border-radius: 50%; padding: 4px; box-shadow: var(--kvc-glow);\n  background: linear-gradient(45deg, var(--kvc-primary), var(--kvc-accent), var(--kvc-primary-2)); }\n.kvc .kvc-avatar-img, .kvc .kvc-avatar-ph { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; object-position: 50% 25%;\n  border: 2px solid var(--kvc-surface); background: #FFFFFF; }\n.kvc .kvc-avatar-ph { display: grid; place-items: center; font-size: 40px; font-weight: 800; color: var(--kvc-primary); }\n.kvc .kvc-verified { position: absolute; right: 6px; bottom: 4px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px;\n  color: var(--kvc-on); background: var(--kvc-primary); border: 2px solid var(--kvc-surface); box-shadow: 0 4px 10px -2px rgba(0, 0, 0, .25); }\n.kvc .kvc-name { margin: 0; font-size: 28px; line-height: 1.15; font-weight: 800; letter-spacing: -.02em; color: var(--kvc-text); }\n.kvc .kvc-role { display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; padding: 4px 12px; border-radius: 999px; font-size: 12px;\n  background: var(--kvc-tint); border: 1px solid color-mix(in srgb, var(--kvc-primary) 22%, transparent); }\n.kvc .kvc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--kvc-primary); animation: kvc-pulse 2s infinite; }\n@keyframes kvc-pulse { 50% { opacity: .45; } }\n.kvc .kvc-title { font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--kvc-primary-2); }\n.kvc.kvc-dark .kvc-title { color: var(--kvc-accent); }\n.kvc .kvc-sep { color: var(--kvc-faint); }\n.kvc .kvc-company { font-weight: 600; color: var(--kvc-text-2); }\n.kvc .kvc-tagline { margin: 12px 0 0; max-width: 320px; font-size: 13px; color: var(--kvc-muted); line-height: 1.6; }\n.kvc .kvc-save { width: 100%; margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 14px 18px; border-radius: 16px;\n  font-size: 14px; font-weight: 700; color: var(--kvc-on); background: linear-gradient(90deg, var(--kvc-primary), var(--kvc-primary-2)); box-shadow: var(--kvc-glow); transition: transform .15s, filter .2s; }\n.kvc .kvc-save:hover { filter: brightness(1.06); }\n.kvc .kvc-save:active { transform: scale(.98); }\n.kvc .kvc-save .kvc-i { font-size: 18px; }\n.kvc .kvc-bounce { animation: kvc-bounce 1.2s infinite; }\n@keyframes kvc-bounce { 0%, 100% { transform: translateY(-15%); animation-timing-function: cubic-bezier(.8, 0, 1, 1); } 50% { transform: none; animation-timing-function: cubic-bezier(0, 0, .2, 1); } }\n.kvc .kvc-save-chip { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 2px 8px; border-radius: 999px; background: rgba(255, 255, 255, .2); }\n.kvc .kvc-pills { width: 100%; margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }\n.kvc .kvc-pill { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border-radius: 12px; font-size: 11px; font-weight: 600;\n  background: var(--kvc-pill); border: 1px solid var(--kvc-line); color: var(--kvc-text-2); transition: background .2s, transform .15s; }\n.kvc .kvc-pill .kvc-i { font-size: 15px; color: var(--kvc-primary); transition: transform .2s; }\n.kvc .kvc-pill:hover .kvc-i { transform: scale(1.12); }\n.kvc .kvc-pill-wa { background: color-mix(in srgb, var(--kvc-wa) 9%, var(--kvc-surface)); border-color: color-mix(in srgb, var(--kvc-wa) 30%, transparent); color: color-mix(in srgb, var(--kvc-wa) 70%, var(--kvc-text)); }\n.kvc .kvc-pill-wa .kvc-i { color: var(--kvc-wa); font-size: 17px; }\n\n.kvc .kvc-divider { display: flex; align-items: center; gap: 12px; margin: 24px 0 14px; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--kvc-faint); font-weight: 600; }\n.kvc .kvc-divider::before, .kvc .kvc-divider::after { content: \"\"; flex: 1; height: 1px; background: var(--kvc-line); }\n\n/* Hub · canales */\n.kvc .kvc-c-whatsapp { --kvc-c: var(--kvc-wa); }\n.kvc .kvc-c-email { --kvc-c: var(--kvc-mail); }\n.kvc .kvc-c-linkedin { --kvc-c: var(--kvc-li); }\n.kvc .kvc-c-website { --kvc-c: var(--kvc-web); }\n.kvc .kvc-c-instagram { --kvc-c: var(--kvc-ig); }\n.kvc .kvc-c-maps { --kvc-c: var(--kvc-map); }\n.kvc .kvc-c-phone { --kvc-c: var(--kvc-tel); }\n.kvc .kvc-c-qr { --kvc-c: var(--kvc-primary); }\n.kvc .kvc-hlist { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }\n.kvc .kvc-hl-txt small { font-variant-numeric: tabular-nums; letter-spacing: .01em; }\n.kvc .kvc-hl { display: flex; align-items: center; gap: 14px; padding: 13px 12px 13px 13px; border-radius: 16px; background: var(--kvc-tile); border: 1px solid var(--kvc-line);\n  transition: border-color .2s, background .2s, transform .15s; }\n.kvc .kvc-hl:hover { border-color: var(--kvc-c); background: color-mix(in srgb, var(--kvc-c) 6%, var(--kvc-tile)); }\n.kvc .kvc-hl:active { transform: scale(.99); }\n.kvc .kvc-hl-ic { width: 44px; height: 44px; border-radius: 12px; flex: none; display: grid; place-items: center; font-size: 20px; color: var(--kvc-c);\n  background: color-mix(in srgb, var(--kvc-c) 11%, transparent); box-shadow: 0 1px 2px rgba(0, 0, 0, .05); transition: all .2s; }\n.kvc .kvc-hl:hover .kvc-hl-ic { color: var(--kvc-on); background: var(--kvc-c); }\n.kvc .kvc-c-instagram:hover .kvc-hl-ic { background: linear-gradient(45deg, var(--kvc-ig-1), var(--kvc-ig)); }\n.kvc .kvc-hl-txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }\n.kvc .kvc-hl-txt strong { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--kvc-text); transition: color .2s; }\n.kvc .kvc-hl:hover .kvc-hl-txt strong { color: var(--kvc-c); }\n.kvc .kvc-hl-txt small { font-size: 12px; color: var(--kvc-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: \"Space Grotesk\", \"Plus Jakarta Sans\", Inter, -apple-system, \"Segoe UI\", Roboto, sans-serif; }\n.kvc .kvc-c-maps .kvc-hl-txt small { font-family: inherit; }\n.kvc .kvc-hl-go { width: 32px; height: 32px; flex: none; display: grid; place-items: center; font-size: 14px; color: var(--kvc-faint); transition: transform .2s, color .2s; }\n.kvc .kvc-hl:hover .kvc-hl-go { color: var(--kvc-c); transform: translateX(3px); }\n.kvc .kvc-hl-main { border-color: color-mix(in srgb, var(--kvc-wa) 45%, transparent); background: color-mix(in srgb, var(--kvc-wa) 7%, var(--kvc-tile)); }\n.kvc .kvc-hl-main .kvc-hl-ic { color: var(--kvc-on); background: linear-gradient(135deg, var(--kvc-wa-brand), var(--kvc-wa)); }\n.kvc .kvc-chip-main { font-style: normal; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; padding: 2px 7px; border-radius: 999px;\n  color: var(--kvc-on); background: var(--kvc-wa); }\n\n/* Hub · mini QR */\n.kvc .kvc-mini { margin-top: 22px; padding: 14px; border-radius: 16px; display: flex; align-items: center; gap: 13px;\n  background: linear-gradient(135deg, var(--kvc-tint), color-mix(in srgb, var(--kvc-soft) 60%, transparent)); border: 1px solid color-mix(in srgb, var(--kvc-primary) 20%, transparent); }\n.kvc .kvc-mini-qr { width: 58px; height: 58px; flex: none; padding: 4px; border-radius: 12px; background: #FFFFFF; border: 1px solid var(--kvc-line); box-shadow: 0 1px 3px rgba(0, 0, 0, .06); }\n.kvc .kvc-mini-txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }\n.kvc .kvc-mini-txt strong { font-size: 12px; color: var(--kvc-text); }\n.kvc .kvc-mini-txt small { font-size: 11px; color: var(--kvc-muted); }\n.kvc .kvc-mini-btn { padding: 7px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; color: var(--kvc-primary); background: var(--kvc-surface); border: 1px solid var(--kvc-line); box-shadow: 0 1px 3px rgba(0, 0, 0, .06); transition: transform .15s; }\n.kvc.kvc-dark .kvc-mini-btn { color: var(--kvc-accent); }\n.kvc .kvc-mini-btn:hover { transform: scale(1.05); }\n.kvc .kvc-powered { margin-top: 22px; text-align: center; font-size: 12px; color: var(--kvc-faint); display: grid; gap: 3px; }\n.kvc .kvc-powered strong { color: var(--kvc-primary); }\n.kvc.kvc-dark .kvc-powered strong { color: var(--kvc-accent); }\n.kvc .kvc-powered small { font-size: 10px; }\n.kvc .kvc-qr-slot svg { width: 100%; height: auto; display: block; }\n\n/* ── Tarjeta 3D ───────────────────────────────────────────────────────── */\n.kvc .kvc-cardview { max-width: 672px; display: flex; flex-direction: column; align-items: center; }\n.kvc .kvc-flipbar { width: 100%; max-width: 512px; display: flex; align-items: center; justify-content: space-between; margin: 0 0 16px; padding: 0 6px; font-size: 12px; color: var(--kvc-muted); font-weight: 500; }\n.kvc .kvc-flipbar > span { display: flex; align-items: center; gap: 6px; }\n.kvc .kvc-flipbar > span .kvc-i { color: var(--kvc-primary); }\n.kvc .kvc-btn-xs { display: flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 9px; font-size: 12px; font-weight: 700; color: var(--kvc-on); background: var(--kvc-primary); }\n.kvc .kvc-scene { width: 100%; max-width: 576px; height: 340px; perspective: 1200px; cursor: pointer; user-select: none; }\n.kvc .kvc-c3d { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.2, .7, .2, 1); border-radius: 24px; }\n.kvc .kvc-c3d.kvc-flipped { transform: rotateY(180deg); }\n.kvc .kvc-face { position: absolute; inset: 0; border-radius: 24px; overflow: hidden; -webkit-backface-visibility: hidden; backface-visibility: hidden;\n  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, .3); }\n.kvc .kvc-front { display: flex; background: #FFFFFF; border: 1px solid #E2E8F0; color: #1E293B; }\n.kvc .kvc-front-side { width: 36%; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 18px 12px;\n  background: var(--kvc-soft); border-right: 1px solid color-mix(in srgb, var(--kvc-soft) 80%, var(--kvc-primary)); }\n.kvc .kvc-front-avatar { width: 88px; height: 88px; border-radius: 50%; padding: 3px; background: linear-gradient(135deg, var(--kvc-primary), var(--kvc-accent)); box-shadow: 0 4px 10px -3px rgba(0, 0, 0, .25); }\n.kvc .kvc-front-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; object-position: 50% 25%; background: #FFFFFF; }\n.kvc .kvc-front-logo { background: #FFFFFF; padding: 4px 6px; border-radius: 9px; box-shadow: 0 1px 3px rgba(0, 0, 0, .08); }\n.kvc .kvc-front-logo img { height: 42px; width: auto; }\n.kvc .kvc-front-qr { display: flex; flex-direction: column; align-items: center; gap: 4px; }\n.kvc .kvc-front-qrbox { width: 76px; height: 76px; padding: 4px; border-radius: 11px; background: #FFFFFF; border: 1px solid color-mix(in srgb, var(--kvc-primary) 25%, #FFFFFF); }\n.kvc .kvc-front-qr > span { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--kvc-primary); font-family: \"Space Grotesk\", \"Plus Jakarta Sans\", Inter, -apple-system, \"Segoe UI\", Roboto, sans-serif; }\n.kvc .kvc-front-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 20px 14px; }\n.kvc .kvc-front-name { margin: 0; font-size: 21px; font-weight: 900; letter-spacing: -.02em; color: var(--kvc-ink); line-height: 1.15; }\n.kvc .kvc-front-title { margin: 3px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--kvc-primary); }\n.kvc .kvc-front-co { margin: 0; font-size: 12px; font-weight: 500; color: #64748B; }\n.kvc .kvc-front-rule { width: 80px; height: 4px; border-radius: 9px; margin: 10px 0 4px; background: linear-gradient(90deg, var(--kvc-primary), var(--kvc-accent)); }\n.kvc .kvc-front-rows { display: grid; gap: 5px; }\n.kvc .kvc-fr { display: flex; align-items: center; gap: 9px; font-size: 11.5px; color: #334155; min-width: 0; }\n.kvc .kvc-fr-ic { width: 18px; flex: none; display: grid; place-items: center; font-size: 13px; color: var(--kvc-c); }\n.kvc .kvc-fr.kvc-c-email { --kvc-c: #C084FC; }\n.kvc .kvc-fr.kvc-c-website { --kvc-c: #0EA5E9; }\n.kvc .kvc-fr.kvc-c-linkedin { --kvc-c: #0A66C2; }\n.kvc .kvc-fr-t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.kvc .kvc-fr.kvc-c-phone .kvc-fr-t { font-weight: 600; color: #1E293B; }\n.kvc .kvc-fr:hover .kvc-fr-t { color: var(--kvc-c); text-decoration: underline; text-underline-offset: 2px; }\n.kvc .kvc-front-foot { margin-top: 8px; padding-top: 7px; border-top: 1px solid #F1F5F9; display: flex; justify-content: space-between; gap: 8px; font-size: 9.5px; color: #94A3B8; }\n.kvc .kvc-front-foot span { font-family: \"Space Grotesk\", \"Plus Jakarta Sans\", Inter, -apple-system, \"Segoe UI\", Roboto, sans-serif; }\n.kvc .kvc-front-foot strong { color: var(--kvc-primary-2); }\n.kvc .kvc-back { transform: rotateY(180deg); display: flex; flex-direction: column; justify-content: space-between; padding: 24px 26px; color: #FFFFFF;\n  background: linear-gradient(135deg, #080E1E, #0D1B2A, #040813); border: 1px solid color-mix(in srgb, var(--kvc-primary) 40%, transparent); }\n.kvc .kvc-back-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }\n.kvc .kvc-chipset { display: flex; align-items: center; gap: 10px; color: #94A3B8; }\n.kvc .kvc-chip { width: 44px; height: 32px; border-radius: 6px; border: 1px solid #B45309;\n  background: linear-gradient(45deg, #D97706, #FCD34D, #F59E0B);\n  box-shadow: inset 0 0 0 4px rgba(251, 191, 36, .55), inset 22px 0 0 -21px rgba(180, 83, 9, .5), inset 0 16px 0 -15px rgba(180, 83, 9, .5); }\n.kvc .kvc-nfc { font-size: 18px; }\n.kvc .kvc-back-pass { display: flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--kvc-accent); font-family: \"Space Grotesk\", \"Plus Jakarta Sans\", Inter, -apple-system, \"Segoe UI\", Roboto, sans-serif; }\n.kvc .kvc-live { width: 10px; height: 10px; border-radius: 50%; background: #34D399; box-shadow: 0 0 14px #34D399; }\n.kvc .kvc-back-mid { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }\n.kvc .kvc-back-logo { background: #FFFFFF; padding: 10px 12px; border-radius: 16px; box-shadow: var(--kvc-glow); }\n.kvc .kvc-back-logo img { height: 74px; width: auto; }\n.kvc .kvc-back-mid p { margin: 0; max-width: 380px; font-size: 12px; color: #94A3B8; }\n.kvc .kvc-back-foot { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #1E293B; font-size: 12px; color: #64748B; font-family: \"Space Grotesk\", \"Plus Jakarta Sans\", Inter, -apple-system, \"Segoe UI\", Roboto, sans-serif; }\n.kvc .kvc-back-foot > span:last-child { display: flex; gap: 16px; }\n.kvc .kvc-back-foot strong { color: var(--kvc-accent); }\n.kvc .kvc-back-foot em { font-style: normal; }\n.kvc .kvc-sheen { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .5s;\n  background: linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, .25) 40%, rgba(0, 210, 255, .12) 50%, transparent 65%); background-size: 250% 250%; }\n.kvc .kvc-scene:hover .kvc-sheen { opacity: 1; animation: kvc-sheen 2.4s ease infinite; }\n@keyframes kvc-sheen { 0% { background-position: 100% 0; } 100% { background-position: -50% 0; } }\n.kvc .kvc-card-actions { margin-top: 24px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }\n\n/* Botones genéricos */\n.kvc .kvc-btn-s { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 18px; border-radius: 12px; font-size: 12px; font-weight: 700;\n  background: var(--kvc-surface); border: 1px solid var(--kvc-line); color: var(--kvc-text-2); transition: background .2s, transform .15s; }\n.kvc .kvc-btn-s:hover { background: var(--kvc-pill); }\n.kvc .kvc-btn-s:active { transform: scale(.98); }\n.kvc .kvc-btn-s-primary { color: var(--kvc-on); background: var(--kvc-primary); border-color: transparent; box-shadow: var(--kvc-glow); }\n.kvc .kvc-btn-s-primary:hover { background: var(--kvc-primary-2); }\n\n/* ── Código QR ────────────────────────────────────────────────────────── */\n.kvc .kvc-panel-qr { text-align: center; padding: 28px 24px; }\n.kvc .kvc-kicker { display: inline-flex; align-items: center; gap: 7px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;\n  color: var(--kvc-primary-2); background: var(--kvc-tint); border: 1px solid color-mix(in srgb, var(--kvc-primary) 22%, transparent); }\n.kvc.kvc-dark .kvc-kicker { color: var(--kvc-accent); }\n.kvc .kvc-qr-title { margin: 12px 0 0; font-size: 24px; font-weight: 900; color: var(--kvc-text); }\n.kvc .kvc-qr-sub { margin: 4px 0 22px; font-size: 12px; color: var(--kvc-muted); }\n.kvc .kvc-qr-frame { display: inline-block; padding: 18px; border-radius: 24px; background: linear-gradient(45deg, var(--kvc-primary), var(--kvc-accent), var(--kvc-primary-2)); box-shadow: var(--kvc-glow); margin-bottom: 22px; }\n.kvc .kvc-qr-white { padding: 12px; border-radius: 16px; background: #FFFFFF; box-shadow: inset 0 2px 4px rgba(0, 0, 0, .06); }\n.kvc .kvc-qr-big { width: 220px; }\n.kvc .kvc-field { text-align: left; margin-bottom: 18px; }\n.kvc .kvc-field label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 700; color: var(--kvc-text-2); }\n.kvc .kvc-field label em { font-style: normal; font-size: 10px; color: var(--kvc-primary); font-family: \"Space Grotesk\", \"Plus Jakarta Sans\", Inter, -apple-system, \"Segoe UI\", Roboto, sans-serif; }\n.kvc .kvc-field small { display: block; margin-top: 5px; font-size: 10px; color: var(--kvc-faint); }\n.kvc .kvc-field-row { position: relative; }\n.kvc .kvc-input { width: 100%; padding: 10px 70px 10px 13px; border-radius: 12px; font-size: 12px; color: var(--kvc-text); background: var(--kvc-tile); border: 1px solid var(--kvc-line); outline: none; }\n.kvc .kvc-input:focus { box-shadow: 0 0 0 2px var(--kvc-primary); }\n.kvc .kvc-mono { font-family: \"Space Grotesk\", \"Plus Jakarta Sans\", Inter, -apple-system, \"Segoe UI\", Roboto, sans-serif; }\n.kvc .kvc-reset { position: absolute; right: 7px; top: 7px; padding: 4px 8px; border-radius: 6px; font-size: 10px; background: var(--kvc-line); color: var(--kvc-text-2); }\n.kvc .kvc-qr-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n.kvc .kvc-qr-actions .kvc-btn-s { padding: 13px 10px; }\n\n/* ── Pie ──────────────────────────────────────────────────────────────── */\n.kvc .kvc-foot { border-top: 1px solid var(--kvc-line); padding: 16px; font-size: 12px; color: var(--kvc-faint); }\n.kvc .kvc-foot-in { max-width: 896px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }\n.kvc .kvc-foot-in p { margin: 0; }\n.kvc .kvc-foot-links { display: flex; align-items: center; gap: 12px; color: var(--kvc-muted); }\n.kvc .kvc-foot-links a:hover, .kvc .kvc-foot-links button:hover { color: var(--kvc-primary); }\n\n/* ── Modales y avisos ─────────────────────────────────────────────────── */\n.kvc .kvc-backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(2, 6, 23, .55); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); animation: kvc-fade .2s both; }\n.kvc.kvc-preview .kvc-backdrop { position: absolute; }\n@keyframes kvc-fade { from { opacity: 0; } }\n.kvc .kvc-modal { position: relative; width: 100%; max-width: 400px; max-height: 90vh; overflow: auto; padding: 24px 20px 20px; border-radius: 22px; background: var(--kvc-surface); border: 1px solid var(--kvc-line); box-shadow: var(--kvc-shadow); }\n.kvc .kvc-modal-x { position: absolute; right: 12px; top: 10px; width: 32px; height: 32px; border-radius: 10px; font-size: 22px; line-height: 1; color: var(--kvc-muted); }\n.kvc .kvc-modal-t { margin: 0 0 4px; font-size: 18px; font-weight: 800; color: var(--kvc-text); }\n.kvc .kvc-modal-s { margin: 0 0 16px; font-size: 12px; color: var(--kvc-muted); }\n.kvc .kvc-share-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }\n.kvc .kvc-share-opt { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px; border-radius: 14px; font-size: 11px; font-weight: 600; background: var(--kvc-tile); border: 1px solid var(--kvc-line); color: var(--kvc-text-2); }\n.kvc .kvc-share-ic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-size: 19px; color: var(--kvc-on); background: var(--kvc-c); }\n.kvc .kvc-copy { display: flex; gap: 8px; }\n.kvc .kvc-copy .kvc-input { padding-right: 12px; }\n.kvc .kvc-pre { margin: 12px 0 14px; padding: 12px; border-radius: 12px; max-height: 260px; overflow: auto; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;\n  background: var(--kvc-tile); border: 1px solid var(--kvc-line); color: var(--kvc-text-2); font-family: ui-monospace, \"SF Mono\", Menlo, monospace; }\n.kvc .kvc-modal-actions { display: flex; gap: 10px; }\n.kvc .kvc-toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 40px); opacity: 0; pointer-events: none; z-index: 70;\n  max-width: calc(100% - 32px); padding: 12px 18px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #0F172A; color: #FFFFFF; box-shadow: 0 20px 40px -10px rgba(0, 0, 0, .45); transition: all .3s; }\n.kvc .kvc-toast.kvc-on { opacity: 1; transform: translate(-50%, 0); }\n.kvc.kvc-preview .kvc-toast { position: absolute; }\n\n/* ── Ajustes por ancho ────────────────────────────────────────────────── */\n@container (min-width: 640px) {\n  .kvc .kvc-head-in { padding: 0 24px; }\n  .kvc .kvc-head-sub { display: block; }\n  .kvc .kvc-tab-t { display: inline; }\n  .kvc .kvc-tab { padding: 7px 12px; }\n  .kvc .kvc-body { padding: 40px 16px; align-items: center; }\n  .kvc .kvc-panel { padding: 28px; }\n  .kvc .kvc-name { font-size: 30px; }\n  .kvc .kvc-tagline { font-size: 14px; }\n  .kvc .kvc-scene { height: 350px; }\n  .kvc .kvc-front-side { width: 33.3%; padding: 20px; }\n  .kvc .kvc-front-avatar { width: 96px; height: 96px; }\n  .kvc .kvc-front-qrbox { width: 82px; height: 82px; }\n  .kvc .kvc-front-main { padding: 26px 28px 16px; }\n  .kvc .kvc-front-name { font-size: 25px; }\n  .kvc .kvc-front-title { font-size: 14px; }\n  .kvc .kvc-fr { font-size: 13px; }\n  .kvc .kvc-foot-in { flex-direction: row; justify-content: space-between; text-align: left; }\n}\n@container (max-width: 400px) {\n  .kvc .kvc-scene { height: 300px; }\n  .kvc .kvc-front-side { padding: 12px 8px; }\n  .kvc .kvc-front-avatar { width: 68px; height: 68px; }\n  .kvc .kvc-front-logo img { height: 32px; }\n  .kvc .kvc-front-qrbox { width: 64px; height: 64px; }\n  .kvc .kvc-front-main { padding: 14px 12px 10px; }\n  .kvc .kvc-front-name { font-size: 17px; }\n  .kvc .kvc-front-title, .kvc .kvc-front-co { font-size: 10px; }\n  .kvc .kvc-fr { font-size: 10px; gap: 6px; }\n  .kvc .kvc-front-foot { font-size: 8px; }\n  .kvc .kvc-back { padding: 18px; }\n  .kvc .kvc-back-logo img { height: 56px; }\n  .kvc .kvc-head-logo { height: 36px; }\n  .kvc .kvc-head-word { display: none; }\n  .kvc .kvc-tab { padding: 7px 9px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .kvc .kvc-view, .kvc .kvc-dot, .kvc .kvc-bounce, .kvc .kvc-sheen { animation: none !important; }\n  .kvc .kvc-c3d { transition: none; }\n}\n@media print {\n  .kvc .kvc-head, .kvc .kvc-foot, .kvc .kvc-flipbar, .kvc .kvc-card-actions, .kvc .kvc-bg, .kvc .kvc-toast { display: none !important; }\n  .kvc { background: #FFFFFF; }\n}\n.kvc .kvc-head-co { font-size: 14px; font-weight: 800; color: var(--kvc-ink); white-space: nowrap; }\n@container (max-width: 400px) { .kvc .kvc-head-meta { display: none; } }\n.kvc .kvc-field small.kvc-field-err { color: var(--kvc-map); font-weight: 600; }\n.kvc .kvc-field small.kvc-field-err:empty { display: none; }\n.kvc .kvc-save > span:first-of-type { white-space: nowrap; }\n.kvc .kvc-save-chip { white-space: nowrap; }\n@container (max-width: 430px) { .kvc .kvc-save-chip { display: none; } .kvc .kvc-save { font-size: 14.5px; } }\n";
  function injectCss(doc) {
    doc = doc || document;
    if (doc.getElementById('kvc-card-css')) return;
    var s = doc.createElement('style'); s.id = 'kvc-card-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ── Página autónoma (para alojar en cualquier hosting) ─────────────── */
  function htmlEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function standaloneHtml(profile, coreSrc, extra) {
    extra = extra || {};
    var p = normalize(profile);
    var json = JSON.stringify(p).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    var title = p.name + ' · ' + p.title + (p.company ? ' · ' + p.company : '');
    var desc = 'Tarjeta digital de ' + p.name + '. WhatsApp, correo, LinkedIn, web e Instagram en un toque.';
    return '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<title>' + htmlEsc(title) + '</title>\n' +
      '<meta name="description" content="' + htmlEsc(desc) + '">\n' +
      '<meta name="theme-color" content="' + p.theme.primary + '">\n' +
      '<meta property="og:type" content="profile">\n' +
      '<meta property="og:title" content="' + htmlEsc(title) + '">\n' +
      '<meta property="og:description" content="' + htmlEsc(desc) + '">\n' +
      (extra.ogImage ? '<meta property="og:image" content="' + htmlEsc(extra.ogImage) + '">\n' : '') +
      (extra.canonical ? '<link rel="canonical" href="' + htmlEsc(extra.canonical) + '">\n' : '') +
      (extra.icon ? '<link rel="icon" href="' + htmlEsc(extra.icon) + '">\n<link rel="apple-touch-icon" href="' + htmlEsc(extra.icon) + '">\n' : '') +
      '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
      '<meta name="apple-mobile-web-app-title" content="' + htmlEsc(p.name.split(' ')[0] + ' · ' + (p.company || 'Tarjeta')) + '">\n' +
      '<style>html,body{margin:0;padding:0;background:#F8FAFC}#kvc-root{min-height:100vh;display:flex;flex-direction:column}#kvc-root>.kvc{flex:1}</style>\n' +
      '</head>\n<body>\n<div id="kvc-root"></div>\n<script>\n' + String(coreSrc).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--') + '\n' +
      'KVC.injectCss();KVC.mount(document.getElementById("kvc-root"),' + json + ',{qrUrl:' + JSON.stringify(extra.qrUrl || '') + '||undefined});\n' +
      '</script>\n</body>\n</html>\n';
  }

  return {
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    normalize: normalize,
    links: links,
    channels: channels,
    vcard: vcard,
    qrMatrix: qrMatrix,
    h: h,
    icon: icon,
    checkQrUrl: checkQrUrl,
    qrSvg: qrSvg,
    qrPng: qrPng,
    saveVcf: saveVcf,
    mount: mount,
    injectCss: injectCss,
    standaloneHtml: standaloneHtml,
    resolveImg: resolveImg,
    slug: slug,
    download: download
  };
})();


const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'canales', label: 'Canales' },
  { id: 'marca', label: 'Marca' },
  { id: 'publicar', label: 'Publicar' },
];

/* ── Marca de la empresa (shell.brands) → tarjeta ──────────────────────
   La tarjeta asume la identidad de la marca elegida: color base y acento,
   color de texto, superficie suave, logotipos (sobre fondo claro) y la
   tipografía de títulos. Lo personal (nombre, WhatsApp, correo…) no se toca. */
function hexOk(x) { return /^#[0-9a-f]{6}$/i.test(String(x || '')); }
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const WHITE = '#FFFFFF';
const BLACK = '#000000';

function brandToPatch(brand) {
  if (!brand) return null;
  const pal = Array.isArray(brand.palette) ? brand.palette : [];
  const byRole = (r) => { const c = pal.find((x) => x && x.role === r && hexOk(x.hex)); return c ? c.hex.toUpperCase() : ''; };
  const primary = hexOk((brand.baseColor || {}).hex) ? brand.baseColor.hex.toUpperCase() : byRole('base');
  if (!primary) return null;
  let accent = hexOk((brand.accentColor || {}).hex) ? brand.accentColor.hex.toUpperCase() : (byRole('accent') || byRole('baseAlt'));
  if (!accent || accent === primary) accent = mix(primary, WHITE, 0.35);
  let ink = byRole('text');
  if (!ink || lum(ink) > 0.12) ink = mix(primary, BLACK, 0.55);
  let soft = byRole('surface') || byRole('background');
  if (!soft || lum(soft) < 0.75) soft = mix(primary, WHITE, 0.87);

  const logos = Array.isArray(brand.logos) ? brand.logos.filter((l) => l && l.url) : [];
  const isMark = (l) => /iso|icon|ícono|mark|s[ií]mbolo|favicon|monogram/i.test((l.key || '') + ' ' + (l.name || ''));
  const onLight = (l) => l.background === 'light' || l.background === 'transparent' || l.background === 'color';
  const full = brand.logoLight || (logos.find((l) => onLight(l) && !isMark(l)) || {}).url || brand.logoDark || (logos[0] || {}).url || '';
  const mark = (logos.find((l) => isMark(l) && onLight(l)) || logos.find(isMark) || {}).url || full;
  const heading = (Array.isArray(brand.typography) ? brand.typography : []).find((f) => f && (f.usage === 'headings' || f.usage === 'body'));

  const patch = {
    brandId: brand.id || '',
    brandName: brand.name || '',
    theme: { primary, accent, ink, soft },
    font: heading ? String(heading.family || '') : '',
  };
  if (brand.name) patch.company = brand.name;
  if (brand.website) patch.website = brand.website;
  if (brand.tagline || brand.description) patch.motto = brand.tagline || brand.description;
  if (full) { patch.logo = full; patch.logoMark = mark; patch.logoWord = ''; }
  return patch;
}

function baseApi(shell) {
  try {
    const u = shell.assetUrl('x');
    const i = u.indexOf('/api/apps/');
    if (i > 0) return u.slice(0, i);
    if (i === 0) return typeof location !== 'undefined' ? location.origin : '';
  } catch (e) { /* host sin assetUrl */ }
  return typeof location !== 'undefined' ? location.origin : '';
}

function fileToDataUrl(file, kind) {
  // Foto: recorte cuadrado 480 px JPEG. Logos: hasta 640 px, PNG (transparencia).
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen no es válida'));
      img.onload = () => {
        const c = document.createElement('canvas');
        const g = c.getContext('2d');
        if (kind === 'photo') {
          const s = 480; c.width = s; c.height = s;
          const r = Math.max(s / img.naturalWidth, s / img.naturalHeight);
          const w = img.naturalWidth * r, hh = img.naturalHeight * r;
          g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
          g.drawImage(img, (s - w) / 2, (s - hh) / 2, w, hh);
          resolve(c.toDataURL('image/jpeg', 0.86));
        } else {
          const max = 640;
          const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
          g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/png'));
        }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, name) {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => resolve(''); fr.readAsDataURL(blob); });
}

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo } = React;

  const instanceId = (shell.app && shell.app.instanceId) || '';
  const resolveAsset = (name) => { try { return shell.assetUrl(name); } catch (e) { return name; } };

  /* ── Estado (un modelo en el closure; UI y agente mutan lo mismo) ── */
  let model = { profile: KVC.normalize(KVC.DEFAULT_PROFILE), published: false, publishedAt: '', loaded: false };
  let ui = { tab: 'perfil', device: 'mobile', busy: '', error: '' };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l({ model, ui }));
  let saveT = null;
  let pubT = null;
  let disposed = false;

  function setUi(patch) { ui = Object.assign({}, ui, patch); emit(); }
  function commit(next, opts) {
    model = Object.assign({}, model, next);
    emit();
    clearTimeout(saveT);
    saveT = setTimeout(save, 600);
    if (model.published && !(opts && opts.noPublish)) {
      clearTimeout(pubT);
      pubT = setTimeout(() => { void publish(true); }, 1500);
    }
  }
  function updateProfile(patch) {
    const p = Object.assign({}, model.profile, patch);
    if (patch.theme) p.theme = Object.assign({}, model.profile.theme, patch.theme);
    commit({ profile: KVC.normalize(p) });
  }

  async function save() {
    if (!instanceId || disposed) return;
    try {
      await shell.saveData({ v: 1, profile: model.profile, published: model.published, publishedAt: model.publishedAt });
    } catch (e) {
      setUi({ error: 'No se pudo guardar: ' + String((e && e.message) || e) });
    }
  }

  /* Marcas del tenant: TODAS, para elegir (una empresa puede tener submarcas). */
  let brands = { list: [], currentId: '', loaded: false, error: '' };
  async function loadBrands() {
    if (!shell.brands || !shell.brands.list) { brands = Object.assign({}, brands, { loaded: true }); emit(); return; }
    try {
      const r = await shell.brands.list();
      brands = { list: (r && r.brands) || [], currentId: (r && r.currentId) || '', loaded: true, error: '' };
    } catch (e) {
      brands = Object.assign({}, brands, { loaded: true, error: 'No se pudieron leer las marcas.' });
    }
    emit();
  }
  function applyBrand(brand, quiet) {
    const patch = brandToPatch(brand);
    if (!patch) { if (!quiet) shell.notify({ level: 'warn', text: 'Esa marca no define un color base: complétala en la app Marcas.' }); return false; }
    updateProfile(patch);
    if (!quiet) shell.notify({ level: 'success', text: 'Tarjeta con la identidad de ' + (brand.name || 'la marca') });
    return true;
  }

  /* Instancia nueva en OTRA empresa: la tarjeta nace con la persona conectada
     (/api/identity/me) y con la marca por defecto del tenant, no con FIGIT. */
  async function seedNewInstance() {
    let me = null;
    try {
      const req = typeof shell.authFetch === 'function' ? shell.authFetch : null;
      if (req) {
        const res = await req('/api/identity/me', { cache: 'no-store' });
        if (res.ok) me = await res.json();
      }
    } catch (e) { /* opcional */ }
    const email = String((me && me.email) || '').toLowerCase();
    if (email && email !== KVC.DEFAULT_PROFILE.email) {
      const name = String(me.displayName || me.name || email);
      const phone = String(me.phone || '');
      const first = name.split(' ')[0];
      updateProfile({
        name, firstName: first, lastName: name.split(' ').slice(1).join(' '),
        title: String(me.description || ''), email, phone, whatsapp: phone.replace(/\D/g, ''),
        whatsappMsg: 'Hola ' + first + ', te contacto desde tu tarjeta digital.',
        photo: String(me.photoUrl || ''), tagline: '', linkedin: '', instagram: '', address: '', city: '', region: '',
        location: String(me.location || ''), cardId: '', hashtag: '', publicUrl: '',
      });
    }
    if (shell.brands && shell.brands.current) {
      try {
        const cur = await shell.brands.current();
        // FIGIT ya viene de fábrica: solo se aplica una marca distinta.
        if (cur && !/figit/i.test(cur.name || '')) applyBrand(cur, true);
      } catch (e) { /* tenant sin marca: se queda la paleta por defecto */ }
    }
  }

  async function load() {
    if (!instanceId) { model = Object.assign({}, model, { loaded: true }); emit(); return; }
    let fresh = true;
    try {
      const d = await shell.loadData();
      if (d && d.profile) {
        fresh = false;
        model = Object.assign({}, model, {
          profile: KVC.normalize(d.profile), published: d.published === true, publishedAt: d.publishedAt || '',
        });
      }
    } catch (e) { /* instancia nueva */ }
    if (fresh) await seedNewInstance();
    model = Object.assign({}, model, { loaded: true });
    emit();
  }

  /* ── Enlace público ── */
  function kimosUrl() {
    if (!instanceId) return '';
    return baseApi(shell) + '/api/apps/' + APP_ID + '/asset/card.html?i=' + encodeURIComponent(instanceId);
  }
  /* Destino del QR: siempre una URL https pública y abrible desde otro
     teléfono. Un dominio propio inválido NO se usa (se avisa en Publicar). */
  function qrTarget() {
    const cands = [model.profile.publicUrl, kimosUrl(), model.profile.website];
    return cands.find((u) => u && KVC.checkQrUrl(u).ok) || kimosUrl() || 'https://figit.ai';
  }

  /* Prueba real del enlace: el QR de KIMOS se comprueba pidiendo lo mismo
     que pedirá el teléfono que escanee (la definición pública) y mirando que
     traiga ESTA tarjeta. Un dominio propio solo puede comprobarse que responde. */
  async function testLink() {
    const url = qrTarget();
    const chk = KVC.checkQrUrl(url);
    if (!chk.ok) return { ok: false, text: chk.reason };
    if (url === kimosUrl()) {
      if (!model.published) return { ok: false, text: 'El QR apunta a tu página de KIMOS, pero la tarjeta aún no está publicada: quien escanee verá «no publicada».' };
      try {
        const r = await fetch(baseApi(shell) + '/api/public/app/' + encodeURIComponent(instanceId) + '/definition', { cache: 'no-store' });
        if (!r.ok) return { ok: false, text: 'La página pública respondió ' + r.status + '. Vuelve a publicar.' };
        const j = await r.json();
        const pub = j && j.data && j.data.profile;
        if (!pub || pub.name !== model.profile.name) return { ok: false, text: 'La página pública aún muestra datos anteriores. Espera unos segundos y prueba otra vez.' };
        return { ok: true, text: 'Verificado: el QR abre la tarjeta de ' + pub.name + ' con ' + KVC.channels(KVC.normalize(pub)).length + ' canales de contacto.' };
      } catch (e) {
        return { ok: false, text: 'No se pudo comprobar: ' + String((e && e.message) || e) };
      }
    }
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      return { ok: true, text: 'El dominio responde. Ábrelo una vez en tu teléfono para confirmar que muestra tu tarjeta.' + (chk.warn ? ' ' + chk.warn : '') };
    } catch (e) {
      return { ok: false, text: 'El dominio no responde: el QR no abriría nada. Revisa la dirección o súbele el HTML exportado.' };
    }
  }

  /* Imágenes subidas: con `shell.files` pasan a URL pública (no ocupan el
     documento); sin él quedan embebidas como data: comprimido. */
  async function storeImage(dataUrl, name) {
    if (shell.files && shell.files.upload) {
      try {
        return await shell.files.upload(dataUrlToFile(dataUrl, name), { folder: 'tarjeta', maxMB: 4 });
      } catch (e) { /* sin cuota o permiso: se embebe */ }
    }
    return dataUrl;
  }

  async function publish(enabled) {
    if (!instanceId || !shell.items) {
      setUi({ error: 'Abre la app como documento (🗂️ Nuevo) para poder publicarla.' });
      return false;
    }
    const definicion = {
      kind: 'definition',
      public: {
        enabled: !!enabled,
        channels: [],
        // Lo que ve el mundo: SOLO la tarjeta. Es información de contacto
        // pensada para compartirse; nada más de la instancia sale de aquí.
        data: enabled ? { profile: model.profile, app: APP_ID, version: APP_VERSION } : {},
      },
    };
    try {
      const existentes = await shell.items.list();
      const previo = (existentes || []).find((it) => it && it.id === 'definition');
      if (previo) await shell.items.update('definition', definicion);
      else await shell.items.create(Object.assign({ id: 'definition' }, definicion));
      commit({ published: !!enabled, publishedAt: enabled ? new Date().toISOString() : '' }, { noPublish: true });
      setUi({ error: '' });
      return true;
    } catch (e) {
      setUi({ error: 'No se pudo publicar: ' + String((e && e.message) || e) });
      return false;
    }
  }

  async function exportHtml() {
    setUi({ busy: 'export' });
    try {
      const coreSrc = await fetch(resolveAsset('kvc-core.js')).then((r) => {
        if (!r.ok) throw new Error('asset kvc-core.js (' + r.status + ')');
        return r.text();
      });
      const p = Object.assign({}, model.profile);
      for (const k of ['photo', 'logo', 'logoMark', 'logoWord']) {
        const src = KVC.resolveImg(p[k], resolveAsset);
        if (src && src.indexOf('data:') !== 0) {
          try { p[k] = await blobToDataUrl(await fetch(src).then((r) => r.blob())); } catch (e) { /* se deja la URL */ }
        }
      }
      const html = KVC.standaloneHtml(p, coreSrc, { qrUrl: p.publicUrl || '' });
      KVC.download(KVC.slug(p.name) + '_tarjeta.html', new Blob([html], { type: 'text/html;charset=utf-8' }));
      shell.notify({ level: 'success', text: 'HTML exportado: súbelo como index.html a tu dominio.' });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo exportar: ' + String((e && e.message) || e) });
    }
    setUi({ busy: '' });
  }

  /* ── Agente ── */
  const EDITABLE = ['name', 'firstName', 'lastName', 'title', 'company', 'tagline', 'phone', 'whatsapp', 'whatsappMsg',
    'email', 'website', 'linkedin', 'instagram', 'address', 'city', 'region', 'country', 'publicUrl', 'cardId', 'motto', 'location', 'hashtag'];
  let agentOff = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    const props = {};
    EDITABLE.forEach((k) => { props[k] = { type: 'string' }; });
    agentOff = shell.agent.register({
      label: 'KIMOS vCard',
      description: 'Tarjeta de contacto virtual con QR: consulta y edita los datos (nombre, cargo, WhatsApp, correo, LinkedIn, web, Instagram, dirección), publica o despublica la página que abre el QR y entrega su enlace.',
      tools: [
        { name: 'GET_CARD', description: 'Devuelve los datos de la tarjeta, si está publicada y el enlace del QR.', inputSchema: { type: 'object', properties: {} } },
        { name: 'UPDATE_CARD', description: 'Actualiza campos de la tarjeta. Solo se cambian los campos enviados. whatsapp va en dígitos con código de país (56987161097).', inputSchema: { type: 'object', properties: props } },
        { name: 'SET_PUBLISHED', description: 'Publica (true) o despublica (false) la página pública que abre el QR.', inputSchema: { type: 'object', properties: { published: { type: 'boolean' } }, required: ['published'] } },
      ],
      getSnapshot: () => ({
        app: APP_ID, version: APP_VERSION, profile: Object.assign({}, model.profile, {
          photo: model.profile.photo ? '(imagen)' : '', logo: '(imagen)', logoMark: '(imagen)', logoWord: '(imagen)',
        }), published: model.published, qrUrl: qrTarget(), kimosPublicUrl: kimosUrl(),
      }),
      dispatchAction: async (action) => {
        const t = action && action.type;
        const pl = (action && action.payload) || {};
        if (t === 'GET_CARD') return { success: true, message: JSON.stringify({ profile: model.profile.name, published: model.published, qrUrl: qrTarget() }) };
        if (t === 'UPDATE_CARD') {
          const patch = {};
          EDITABLE.forEach((k) => { if (typeof pl[k] === 'string') patch[k] = pl[k].slice(0, 400); });
          if (!Object.keys(patch).length) return { success: false, error: 'No llegó ningún campo editable.' };
          updateProfile(patch);
          return { success: true, message: 'Tarjeta actualizada: ' + Object.keys(patch).join(', ') };
        }
        if (t === 'SET_PUBLISHED') {
          const ok = await publish(pl.published === true);
          return ok ? { success: true, message: pl.published ? 'Publicada en ' + qrTarget() : 'Despublicada' } : { success: false, error: ui.error };
        }
        return { success: false, error: 'Acción desconocida: ' + t };
      },
    });
  }

  if (shell.documents) {
    try {
      shell.documents.onSerialize(() => ({ profile: model.profile }));
      shell.documents.onLoad((cfg) => { if (cfg && cfg.profile) commit({ profile: KVC.normalize(cfg.profile) }); });
    } catch (e) { /* host sin documentos */ }
  }

  KVC.injectCss();
  void load();
  void loadBrands();

  /* ── Componentes ── */
  function Field(props) {
    const { label, k, profile, type, placeholder, help, area } = props;
    const val = profile[k] || '';
    const onChange = (e) => updateProfile({ [k]: e.target.value });
    return h('label', { className: 'kvcx-field' + (props.wide ? ' kvcx-wide' : '') },
      h('span', { className: 'kvcx-label' }, label),
      area
        ? h('textarea', { className: 'kvcx-input', rows: 3, value: val, placeholder, onChange })
        : h('input', { className: 'kvcx-input', type: type || 'text', value: val, placeholder, onChange }),
      help ? h('span', { className: 'kvcx-help' }, help) : null);
  }

  function ImageField(props) {
    const { label, k, kind, profile } = props;
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const src = KVC.resolveImg(profile[k], resolveAsset);
    const onFile = async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { shell.notify({ level: 'warn', text: 'Elige una imagen (JPG, PNG o WebP).' }); return; }
      setBusy(true);
      try {
        const data = await fileToDataUrl(f, kind);
        const url = await storeImage(data, k + (kind === 'photo' ? '.jpg' : '.png'));
        updateProfile({ [k]: url });
      } catch (err) {
        shell.notify({ level: 'error', text: String((err && err.message) || err) });
      }
      setBusy(false);
    };
    return h('div', { className: 'kvcx-img' },
      h('div', { className: 'kvcx-img-prev' + (kind === 'photo' ? ' kvcx-round' : '') }, src ? h('img', { src, alt: '' }) : h('span', null, 'Sin imagen')),
      h('div', { className: 'kvcx-img-meta' },
        h('span', { className: 'kvcx-label' }, label),
        h('div', { className: 'kvcx-row' },
          h('button', { type: 'button', className: 'kvcx-btn', disabled: busy, onClick: () => inputRef.current && inputRef.current.click() }, busy ? 'Subiendo…' : 'Cambiar'),
          h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: () => updateProfile({ [k]: KVC.DEFAULT_PROFILE[k] }) }, 'Original')),
        h('input', { ref: inputRef, type: 'file', accept: 'image/*', hidden: true, onChange: onFile })));
  }

  function ColorField({ label, k, profile }) {
    return h('label', { className: 'kvcx-color' },
      h('input', { type: 'color', value: profile.theme[k], onChange: (e) => updateProfile({ theme: { [k]: e.target.value } }) }),
      h('span', null, label));
  }

  function Preview({ profile, qrUrl, device }) {
    const ref = useRef(null);
    const key = useMemo(() => JSON.stringify(profile) + '|' + qrUrl, [profile, qrUrl]);
    useEffect(() => {
      if (!ref.current) return undefined;
      let inst = null;
      const t = setTimeout(() => {
        inst = KVC.mount(ref.current, profile, { preview: true, storage: false, resolve: resolveAsset, qrUrl });
      }, 180);
      return () => { clearTimeout(t); if (inst) inst.destroy(); };
    }, [key]);
    return h('div', { className: 'kvcx-device kvcx-device-' + device },
      h('div', { className: 'kvcx-device-screen', ref }));
  }

  function PublishPane({ m }) {
    const url = qrTarget();
    const kurl = kimosUrl();
    const qrRef = useRef(null);
    const [test, setTest] = useState(null);
    const own = m.profile.publicUrl ? KVC.checkQrUrl(m.profile.publicUrl) : null;
    const runTest = async () => { setTest({ busy: true, text: 'Comprobando…' }); setTest(await testLink()); };
    useEffect(() => { setTest(null); }, [url, m.published]);
    useEffect(() => {
      if (!qrRef.current) return;
      try { qrRef.current.replaceChildren(KVC.qrSvg(url, { dark: m.profile.theme.ink, logo: KVC.resolveImg(m.profile.logoMark, resolveAsset) })); }
      catch (e) { qrRef.current.textContent = 'Enlace demasiado largo para un QR.'; }
    }, [url, m.profile.theme.ink, m.profile.logoMark]);
    const copy = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => shell.notify({ level: 'success', text: 'Enlace copiado' }));
    };
    const png = () => {
      fetch(KVC.resolveImg(m.profile.logoMark, resolveAsset)).then((r) => r.blob()).then(blobToDataUrl).catch(() => '')
        .then((logo) => KVC.qrPng(url, { dark: m.profile.theme.ink, logo, px: 1400 }))
        .then((b) => KVC.download('QR_' + KVC.slug(m.profile.name) + '.png', b))
        .catch(() => shell.notify({ level: 'error', text: 'No se pudo generar el PNG' }));
    };
    return h('div', { className: 'kvcx-pane' },
      h('div', { className: 'kvcx-status ' + (m.published ? 'kvcx-ok' : 'kvcx-off') },
        h('span', { className: 'kvcx-status-dot' }),
        h('div', null,
          h('strong', null, m.published ? 'Tarjeta publicada' : 'Tarjeta sin publicar'),
          h('small', null, m.published
            ? 'Quien escanee el QR verá tu tarjeta. Los cambios se publican solos.'
            : 'Publícala para que el QR abra tu tarjeta en cualquier teléfono.')),
        h('button', { type: 'button', className: 'kvcx-btn ' + (m.published ? 'kvcx-btn-ghost' : 'kvcx-btn-primary'), disabled: !instanceId, onClick: () => publish(!m.published) },
          m.published ? 'Despublicar' : 'Publicar ahora')),
      !instanceId ? h('p', { className: 'kvcx-warn' }, 'Esta ventana no tiene documento: abre la app desde 🗂️ Documentos → Nuevo para guardar y publicar.') : null,
      h('div', { className: 'kvcx-qr' },
        h('div', { className: 'kvcx-qr-img', ref: qrRef }),
        h('div', { className: 'kvcx-qr-meta' },
          h('span', { className: 'kvcx-label' }, 'El QR abre'),
          h('code', { className: 'kvcx-url' }, url),
          h('div', { className: 'kvcx-row kvcx-wrap' },
            h('button', { type: 'button', className: 'kvcx-btn', onClick: copy }, 'Copiar enlace'),
            h('a', { className: 'kvcx-btn', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir'),
            h('button', { type: 'button', className: 'kvcx-btn', onClick: png }, 'QR en PNG'),
            h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-primary', disabled: test && test.busy, onClick: runTest }, 'Probar el QR')),
          test ? h('p', { className: 'kvcx-test ' + (test.busy ? '' : test.ok ? 'kvcx-test-ok' : 'kvcx-test-bad') }, (test.busy ? '' : test.ok ? '✔ ' : '✖ ') + test.text) : null)),
      own && !own.ok ? h('p', { className: 'kvcx-warn' }, 'Dominio propio no usado: ' + own.reason) : null,
      own && own.ok && own.warn ? h('p', { className: 'kvcx-help' }, own.warn) : null,
      h(Field, { label: 'Dominio propio (opcional)', k: 'publicUrl', profile: m.profile, placeholder: 'https://figit.ai/bryan', wide: true,
        help: 'Si alojas la tarjeta en tu dominio (con «Exportar HTML»), el QR apunta ahí. Vacío = enlace público de KIMOS' + (kurl ? '.' : ' (requiere documento).') }),
      h('div', { className: 'kvcx-row kvcx-wrap' },
        h('button', { type: 'button', className: 'kvcx-btn', disabled: ui.busy === 'export', onClick: exportHtml }, ui.busy === 'export' ? 'Exportando…' : 'Exportar HTML autónomo'),
        h('button', { type: 'button', className: 'kvcx-btn', onClick: () => KVC.saveVcf(m.profile, resolveAsset) }, 'Descargar contacto .vcf')));
  }

  function BrandPicker({ p }) {
    const [sel, setSel] = useState(p.brandId || brands.currentId || '');
    if (!shell.brands) {
      return h('div', { className: 'kvcx-brand kvcx-brand-off' },
        h('strong', null, 'Marca de la empresa'),
        h('small', null, 'Este KIMOS aún no expone el registro de marcas: ajusta logos y colores a mano aquí abajo.'));
    }
    const list = brands.list;
    const chosen = list.find((b) => b.id === sel);
    const sw = (c) => h('span', { className: 'kvcx-sw', style: { background: c }, title: c });
    return h('div', { className: 'kvcx-brand' },
      h('div', { className: 'kvcx-brand-head' },
        h('div', null,
          h('strong', null, 'Marca de la empresa'),
          h('small', null, 'La tarjeta asume el manual de marca: colores, logos y tipografía.')),
        h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: loadBrands }, 'Recargar')),
      !brands.loaded ? h('small', null, 'Cargando marcas…') :
      list.length === 0 ? h('small', null, 'No hay marcas registradas. Créalas en la app «Marcas» de KIMOS y vuelve aquí.') :
      h('div', { className: 'kvcx-brand-list' }, list.map((b) => {
        const pt = brandToPatch(b);
        return h('button', { key: b.id, type: 'button', className: 'kvcx-brand-opt' + (sel === b.id ? ' kvcx-on' : ''), onClick: () => setSel(b.id) },
          (b.logoLight || b.logoDark) ? h('img', { src: b.logoLight || b.logoDark, alt: '' }) : h('span', { className: 'kvcx-brand-ph' }, (b.name || '?').slice(0, 1)),
          h('span', { className: 'kvcx-brand-name' }, b.name || 'Marca', b.isDefault ? h('em', null, 'por defecto') : null),
          pt ? h('span', { className: 'kvcx-sws' }, sw(pt.theme.primary), sw(pt.theme.accent), sw(pt.theme.ink), sw(pt.theme.soft)) : h('small', null, 'sin color base'));
      })),
      chosen && Array.isArray(chosen.warnings) && chosen.warnings.length ? h('ul', { className: 'kvcx-warns' }, chosen.warnings.map((w, i) => h('li', { key: i }, w))) : null,
      h('div', { className: 'kvcx-row kvcx-wrap' },
        h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-primary', disabled: !chosen, onClick: () => applyBrand(chosen) },
          p.brandId && p.brandId === sel ? 'Volver a aplicar la marca' : 'Aplicar esta marca'),
        p.brandName ? h('small', { className: 'kvcx-help' }, 'Aplicada: ' + p.brandName) : null));
  }

  function Component() {
    const [st, setSt] = useState({ model, ui });
    useEffect(() => { listeners.add(setSt); return () => listeners.delete(setSt); }, []);
    const m = st.model, u = st.ui, p = m.profile;
    const pane = {
      perfil: h('div', { className: 'kvcx-pane' },
        h(ImageField, { label: 'Foto de perfil', k: 'photo', kind: 'photo', profile: p }),
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'Nombre en la tarjeta', k: 'name', profile: p, wide: true }),
          h(Field, { label: 'Nombre(s)', k: 'firstName', profile: p, help: 'Para la agenda del teléfono' }),
          h(Field, { label: 'Apellidos', k: 'lastName', profile: p }),
          h(Field, { label: 'Cargo', k: 'title', profile: p }),
          h(Field, { label: 'Empresa', k: 'company', profile: p }),
          h(Field, { label: 'Frase', k: 'tagline', profile: p, area: true, wide: true }))),
      canales: h('div', { className: 'kvcx-pane' },
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'WhatsApp (con código de país)', k: 'whatsapp', profile: p, placeholder: '56987161097', type: 'tel' }),
          h(Field, { label: 'Teléfono visible', k: 'phone', profile: p, placeholder: '+56 9 8716 1097', type: 'tel' }),
          h(Field, { label: 'Mensaje inicial de WhatsApp', k: 'whatsappMsg', profile: p, area: true, wide: true }),
          h(Field, { label: 'Correo', k: 'email', profile: p, type: 'email' }),
          h(Field, { label: 'Sitio web', k: 'website', profile: p, type: 'url' }),
          h(Field, { label: 'LinkedIn', k: 'linkedin', profile: p, type: 'url' }),
          h(Field, { label: 'Instagram', k: 'instagram', profile: p, placeholder: '@cuenta o URL' }),
          h(Field, { label: 'Dirección', k: 'address', profile: p, wide: true }),
          h(Field, { label: 'Ciudad', k: 'city', profile: p }),
          h(Field, { label: 'País', k: 'country', profile: p }))),
      marca: h('div', { className: 'kvcx-pane' },
        h(BrandPicker, { p }),
        h('div', { className: 'kvcx-sub' }, 'Ajuste manual'),
        h(ImageField, { label: 'Logo completo (tarjeta 3D)', k: 'logo', kind: 'logo', profile: p }),
        h(ImageField, { label: 'Isotipo (cabecera y centro del QR)', k: 'logoMark', kind: 'logo', profile: p }),
        h(ImageField, { label: 'Logotipo en texto (cabecera)', k: 'logoWord', kind: 'logo', profile: p }),
        h('div', { className: 'kvcx-colors' },
          h(ColorField, { label: 'Principal', k: 'primary', profile: p }),
          h(ColorField, { label: 'Acento', k: 'accent', profile: p }),
          h(ColorField, { label: 'Texto / QR', k: 'ink', profile: p }),
          h(ColorField, { label: 'Panel suave', k: 'soft', profile: p }),
          h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: () => updateProfile({ theme: KVC.DEFAULT_PROFILE.theme }) }, 'Colores por defecto')),
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'ID de la tarjeta', k: 'cardId', profile: p }),
          h(Field, { label: 'Ubicación (reverso)', k: 'location', profile: p }),
          h(Field, { label: 'Lema (reverso)', k: 'motto', profile: p, area: true, wide: true }),
          h(Field, { label: 'Hashtag', k: 'hashtag', profile: p }),
          h(Field, { label: 'Tipografía', k: 'font', profile: p, help: 'Familia de la marca (si está instalada en el equipo).' }))),
      publicar: h(PublishPane, { m }),
    }[u.tab];

    return h('div', { className: 'kimos-vcard' },
      h('header', { className: 'kvcx-top' },
        h('div', { className: 'kvcx-title' },
          h('strong', null, 'KIMOS vCard'),
          h('span', { className: 'kvcx-ver', title: 'KIMOS vCard v' + APP_VERSION }, 'v' + APP_VERSION),
          m.published ? h('span', { className: 'kvcx-pill-ok' }, '● Publicada') : null),
        h('nav', { className: 'kvcx-tabs' }, TABS.map((t) =>
          h('button', { key: t.id, type: 'button', className: 'kvcx-tab' + (u.tab === t.id ? ' kvcx-tab-on' : ''), onClick: () => setUi({ tab: t.id }) }, t.label))),
        h('div', { className: 'kvcx-actions' },
          h('div', { className: 'kvcx-seg' },
            h('button', { type: 'button', className: u.device === 'mobile' ? 'kvcx-on' : '', onClick: () => setUi({ device: 'mobile' }) }, 'Móvil'),
            h('button', { type: 'button', className: u.device === 'desktop' ? 'kvcx-on' : '', onClick: () => setUi({ device: 'desktop' }) }, 'Escritorio')))),
      u.error ? h('div', { className: 'kvcx-error' }, u.error, h('button', { type: 'button', onClick: () => setUi({ error: '' }) }, '×')) : null,
      h('div', { className: 'kvcx-body' },
        h('section', { className: 'kvcx-editor' }, m.loaded ? pane : h('p', { className: 'kvcx-help' }, 'Cargando…')),
        h('section', { className: 'kvcx-preview' },
          h('div', { className: 'kvcx-preview-k' }, 'Así la verá quien escanee tu QR'),
          m.loaded ? h(Preview, { profile: p, qrUrl: qrTarget(), device: u.device }) : null)));
  }

  return {
    Component,
    unmount() {
      disposed = true;
      clearTimeout(saveT);
      clearTimeout(pubT);
      listeners.clear();
      if (typeof agentOff === 'function') agentOff();
    },
  };
}
