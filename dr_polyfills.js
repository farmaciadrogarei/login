/**
 * FARMÁCIA DROGA REI – Sistema de Agendamento por Telemedicina
 * app.js – Lógica principal da aplicação
 * Compatível: Chrome 60+, Edge 18+, Firefox 60+, Safari 11+,
 *             Samsung Browser 8+, Opera 50+, UC Browser,
 *             Android 7+, iOS 11+, iPad, Mac, PC, Desktop
 */

'use strict';

/* ═══════════════════════════════════════════════
   POLYFILLS / COMPATIBILIDADE
═══════════════════════════════════════════════ */

// Element.closest – IE11, Samsung Browser antigo
if (!Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;
    do { if (el.matches(s)) return el; el = el.parentElement || el.parentNode; }
    while (el !== null && el.nodeType === 1);
    return null;
  };
}

// Element.matches – IE11 + prefixes
if (!Element.prototype.matches) {
  Element.prototype.matches =
    Element.prototype.msMatchesSelector ||
    Element.prototype.webkitMatchesSelector ||
    Element.prototype.mozMatchesSelector;
}

// NodeList.forEach – IE11, Samsung Browser < 6
if (typeof NodeList !== 'undefined' && NodeList.prototype && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = Array.prototype.forEach;
}

// Array.from – IE11
if (!Array.from) {
  Array.from = function(arrayLike) {
    return Array.prototype.slice.call(arrayLike);
  };
}

// String.prototype.padStart – IE11, Safari < 10
if (!String.prototype.padStart) {
  String.prototype.padStart = function(targetLength, padString) {
    var str = String(this);
    padString = padString === undefined ? ' ' : String(padString);
    if (str.length >= targetLength) return str;
    var pad = padString.repeat ? padString.repeat(Math.ceil((targetLength - str.length) / padString.length)) : (function(s, n) { var r = ''; while (n-- > 0) r += s; return r; })(padString, Math.ceil((targetLength - str.length) / padString.length));
    return pad.slice(0, targetLength - str.length) + str;
  };
}

// String.prototype.repeat – IE11
if (!String.prototype.repeat) {
  String.prototype.repeat = function(count) {
    var str = String(this);
    var result = '';
    for (var i = 0; i < count; i++) result += str;
    return result;
  };
}

// Object.assign – IE11
if (typeof Object.assign !== 'function') {
  Object.assign = function(target) {
    if (target == null) throw new TypeError('Cannot convert undefined or null to object');
    var output = Object(target);
    for (var index = 1; index < arguments.length; index++) {
      var source = arguments[index];
      if (source != null) {
        for (var nextKey in source) {
          if (Object.prototype.hasOwnProperty.call(source, nextKey)) {
            output[nextKey] = source[nextKey];
          }
        }
      }
    }
    return output;
  };
}
