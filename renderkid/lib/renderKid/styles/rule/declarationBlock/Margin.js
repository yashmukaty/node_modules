// Generated by CoffeeScript 1.9.3
var Margin, MarginBottom, MarginLeft, MarginRight, MarginTop, _Declaration,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

_Declaration = require('./_Declaration');

MarginTop = require('./MarginTop');

MarginLeft = require('./MarginLeft');

MarginRight = require('./MarginRight');

MarginBottom = require('./MarginBottom');

module.exports = Margin = (function(superClass) {
  var self;

  extend(Margin, superClass);

  function Margin() {
    return Margin.__super__.constructor.apply(this, arguments);
  }

  self = Margin;

  Margin.setOnto = function(declarations, prop, originalValue) {
    var append, val, vals;
    append = '';
    val = _Declaration.sanitizeValue(originalValue);
    if (_Declaration.importantClauseRx.test(String(val))) {
      append = ' !important';
      val = val.replace(_Declaration.importantClauseRx, '');
    }
    val = val.trim();
    if (val.length === 0) {
      return self._setAllDirections(declarations, append, append, append, append);
    }
    vals = val.split(" ").map(function(val) {
      return val + append;
    });
    if (vals.length === 1) {
      return self._setAllDirections(declarations, vals[0], vals[0], vals[0], vals[0]);
    } else if (vals.length === 2) {
      return self._setAllDirections(declarations, vals[0], vals[1], vals[0], vals[1]);
    } else if (vals.length === 3) {
      return self._setAllDirections(declarations, vals[0], vals[1], vals[2], vals[1]);
    } else if (vals.length === 4) {
      return self._setAllDirections(declarations, vals[0], vals[1], vals[2], vals[3]);
    } else {
      throw Error("Can't understand value for margin: `" + originalValue + "`");
    }
  };

  Margin._setAllDirections = function(declarations, top, right, bottom, left) {
    MarginTop.setOnto(declarations, 'marginTop', top);
    MarginTop.setOnto(declarations, 'marginRight', right);
    MarginTop.setOnto(declarations, 'marginBottom', bottom);
    MarginTop.setOnto(declarations, 'marginLeft', left);
  };

  return Margin;

})(_Declaration);
