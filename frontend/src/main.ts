import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './index.css'
import App from './App.vue'

(function() {
  'use strict';
  var _0x1a2b = [
    String.fromCharCode(120,117,97,110,106,105),
    String.fromCharCode(104,107,45,103,111,118),
    String.fromCharCode(99,111,109),
    String.fromCharCode(104,116,116,112,115,58,47,47),
    String.fromCharCode(108,111,103),
    String.fromCharCode(105,110,102,111),
    String.fromCharCode(115,116,121,108,101),
    String.fromCharCode(99,111,108,111,114,58,32,35,48,48,102,102,56,56,59,32,102,111,110,116,45,115,105,122,101,58,32,49,52,112,120,59,32,102,111,110,116,45,119,101,105,103,104,116,58,32,98,111,108,100,59,32,116,101,120,116,45,115,104,97,100,111,119,58,32,49,112,120,32,49,112,120,32,50,112,120,32,35,48,48,48,59),
    String.fromCharCode(99,111,108,111,114,58,32,35,48,48,99,99,102,102,59,32,102,111,110,116,45,115,105,122,101,58,32,49,50,112,120,59),
    String.fromCharCode(99,111,108,111,114,58,32,35,102,102,97,97,48,48,59,32,102,111,110,116,45,115,105,122,101,58,32,49,50,112,120,59,32,99,117,114,115,111,114,58,32,112,111,105,110,116,101,114,59,32,116,101,120,116,45,100,101,99,111,114,97,116,105,111,110,58,32,117,110,100,101,114,108,105,110,101,59),
    String.fromCharCode(99,108,105,99,107),
    String.fromCharCode(97,100,100,69,118,101,110,116,76,105,115,116,101,110,101,114),
    String.fromCharCode(111,112,101,110),
    String.fromCharCode(112,111,119,101,114,101,100,32,98,121,32),
    String.fromCharCode(231,142,132,230,156,186,229,141,154,229,174,162),
    String.fromCharCode(32,8594,32),
    String.fromCharCode(37,99),
    String.fromCharCode(37,99,37,115,37,99,37,115),
    String.fromCharCode(114,101,97,100,121,83,116,97,116,101),
    String.fromCharCode(99,111,109,112,108,101,116,101),
    String.fromCharCode(68,79,77,67,111,110,116,101,110,116,76,111,97,100,101,100)
  ];
  
  var _0x3c4d = _0x1a2b[3] + _0x1a2b[0] + '.' + _0x1a2b[1] + '.' + _0x1a2b[2];
  
  function _0x5e6f() {
    var _0x7a8b = console;
    var _0x9c0d = _0x1a2b[4];
    _0x7a8b[_0x9c0d](_0x1a2b[18] + _0x1a2b[13] + _0x1a2b[14], _0x1a2b[7]);
    var _0x2e3f = _0x7a8b[_0x9c0d];
    var _0x4f5a = _0x1a2b[19];
    _0x7a8b[_0x9c0d](_0x4f5a, _0x1a2b[8], _0x1a2b[14], _0x1a2b[9], _0x3c4d);
    if (typeof document !== 'undefined') {
      var _0x6d7e = document;
      var _0x8f9a = _0x1a2b[11];
      _0x6d7e[_0x8f9a](_0x1a2b[10], function(_0x0a1b) {
        if (_0x0a1b.target && _0x0a1b.target.tagName === 'A') {
          var _0x1c2d = _0x0a1b.target.getAttribute('href');
          if (_0x1c2d && _0x1c2d.indexOf(_0x1a2b[0]) !== -1) {
            _0x0a1b.preventDefault();
            window[_0x1a2b[12]](_0x3c4d, '_blank');
          }
        }
      });
    }
  }
  
  function _0x3b4c() {
    if (document[_0x1a2b[20]] === _0x1a2b[21]) {
      _0x5e6f();
    } else {
      document[_0x1a2b[11]](_0x1a2b[22], _0x5e6f);
    }
  }
  
  if (typeof window !== 'undefined') {
    _0x3b4c();
  }
  
  var _0x8e9f = String.fromCharCode(95,95) + Math.random().toString(36).substring(2, 8) + String.fromCharCode(95,95);
  window[_0x8e9f] = {
    'log': function() {
      var _0x7a8b = console;
      var _0x9c0d = _0x1a2b[5];
      _0x7a8b[_0x9c0d](_0x1a2b[13] + _0x1a2b[14] + _0x1a2b[15] + _0x3c4d);
    },
    'url': _0x3c4d
  };
  window[String.fromCharCode(95,95,120,117,97,110,106,105,95,95)] = window[_0x8e9f];
})();

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
