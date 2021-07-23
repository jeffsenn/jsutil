//var Base64 = require('js-base64').Base64;

function recursivelyOrderKeys(unordered) {
  if (Array.isArray(unordered)) {
    unordered.forEach(function (item, index) {
      unordered[index] = recursivelyOrderKeys(item);
    });
    return unordered;
  }
  if (typeof unordered === 'object') {
    var ordered = {};
    Object.keys(unordered).sort().forEach(function (key) {
      ordered[key] = recursivelyOrderKeys(unordered[key]);
    });
    return ordered;
  }
  return unordered;
};

function stringifyKeysInOrder(data) {
  var sortedData = recursivelyOrderKeys(data);
  return JSON.stringify(sortedData);
};

function orderedJSON(o) {
  if (Array.isArray(o)) {
    return "[" + o.map(orderedJSON).join(',') + "]";
  } else if (!isSpecial(o) && typeof o === 'object') {
    return "{" + Object.entries(o).map(function (a, b) { return '"' + a + '":' + orderedJSON(b); }).sort().join(",") + "}";
  } else {
    return JSON.stringify(o);
  }
}

function shallowCopy(a) {
  return (Array.isArray(a)) ? a.slice() :
    ((typeof a === 'object') ? { ...a } : a);
}

//change a deep value by shallow copying only necessary components so that
//original is left unchanged
function deepEdit(obj, path, value, i) {
  if (!i) i = 0;
  if (i >= path.length) return value;
  obj = isNaN(path[i]) ? ((typeof (obj) === 'object') ? { ...obj } : {})
    : (Array.isArray(obj) ? obj.slice() : [])
  val = deepEdit(obj[path[i]], path, value, i + 1)
  if (val === undefined || val === null) delete obj[path[i]];
  else obj[path[i]] = val;
  return obj
}

// return an object that is equivalent to 'new_obj' but shares (recursively) any shared
// object references with 'orig'.  (This is useful in Redux reducers to minimize object
// reference changes)
function deepMergeUpdates(new_obj, orig) {
  function M(n, o) {
    if (n === o) return o;
    if (typeof n !== typeof o) return n;
    if (n instanceof Date) {
      if (o instanceof Date && n.valueOf() == o.valueOf()) return o;
      return n;
    }
    if (Array.isArray(n)) {
      if (Array.isArray(o)) {
        let mut;
        for (var i in n) {
          if (mut) {
            mut[i] = M(n[i], o[i]);
          } else {
            let newc = M(n[i], o[i]);
            if (newc !== o[i]) {
              mut = o.slice(0, n.length);
              mut[i] = newc;
            }
          }
        }
        return mut ? mut : (n.length == o.length ? o : o.slice(0, n.length));
      }
      return n;
    } else if (typeof n === 'object') {
      let mut = false;
      let n2 = { ...n };
      let count = 0;
      for (var k in n2) {
        count += 1;
        let newc = n2[k] = M(n2[k], o[k]);
        if (!mut && newc !== o[k]) mut = true;
      }
      return (mut || Object.keys(o).length !== count) ? n2 : o;
    } else {
      return n;
    }
  }
  return M(new_obj, orig);
}

function deepFreeze(o) {
  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (o.hasOwnProperty(prop)
      && o[prop] !== null
      && (typeof o[prop] === "object" || typeof o[prop] === "function")
      && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop]);
    }
  });
  Object.freeze(o);
  return o;
};

function isString(myVar) {
  return (typeof myVar === 'string' || myVar instanceof String);
}

function isSpecial(a) {
  return (a && a[""] && Object.keys(a).length == 1) ? a[""][0] : undefined;
}

ErrTok = deepFreeze({ "": ["ErrTok"] });

Null = deepFreeze({ "": ["Null"] }); //NOT js 'null'

class Binary {
  constructor(data) { //from
    if (isSpecial(data) === "Binary") {
      data = data[""][1];
    } else if (!isString(data)) {
      throw Error("TBD: non base64 data");
    }
    this[""] = ["Binary", data];
    deepFreeze(this);
  }
  static isa(x) {
    return isSpecial(x) === "Binary";
  }
}

function isValidDate(date) {
  return date && Object.prototype.toString.call(date) === "[object Date]" && !isNaN(date);
}

//named to not conflict with internal Date
class DateValue {
  constructor(data) { //from
    if (data === undefined) {
      data = (new Date()).toISOString()
    } else if (isSpecial(data) === "Date") {
      data = data[""][1];
    } else if (isValidDate(data)) {
      data = data.toISOString()
    } else {
      const d = new Date(data)
      if (isNaN(d)) throw Error("not convertable to date")
      //big question: should this be ISO format?
      //data = d.toISOString()
    }
    this[""] = ["Date", data];
    deepFreeze(this);
  }
  toDate() {
    return new Date(this[""][1]);
  }
  static isa(x) {
    return isSpecial(x) === "Date";
  }

}

class Fraction {
  constructor(n, d) {
    this[""] = ["Ratio", n, d]
  }
  freduce() {
    let n = this[""][1], d = this[""][2];
    while (d !== 0) [n, d] = [d, (n % d)] //get GCD via Euclid's Algorithm.
    return [n1 / n, d1 / n]
  }
}
class Quantity {
  static str2dim(d) {
    function term_dim(a) {
      const np = a.split('^')
      const [n, p] = np.length === 1 ? [np[0], 1] : np
      x = { 'm': 1, 'kg': 2, 's': 3, 'A': 4, 'K': 5, 'mol': 6, 'cd': 7, 'b': 8 }[n] || int(n)
      return [x, int(p)]
    }
    if (d === '') return null
    return d.split('_').map(_term_dim)
  }
  static dim2str(d) {
    function dim_term(a) {
      const x = (x > 0 && x < 9) ? ['m', 'kg', 's', 'A', 'K', 'mol', 'cd', 'b'][a[0] - 1] : str(x)
      return (a[1] === 1) ? x : x + "^" + str(a[1])
    }
    return '_'.join(d.map(_dim_term))
  }
  static dim_inv(d) {
    return d ? d.map(a => [a[0], -a[1]]) : null
  }
  static dim_mul(a, b) {
    if (!a) return b;
    if (!b) return a;
    const tmp = a.concat(b).sort();
    let i = 0;
    while (i < tmp.length - 1) {
      if (tmp[i][0] === tmp[i + 1][0]) {
        const x = tmp[i][1] + tmp[i + 1][1]
        tmp.splice(i, x === 0 ? 2 : 1)
        if (x === 0) {
          i -= 1
        } else {
          tmp[i] = (tmp[i][0], x)
        }
      }
      i += 1
    }
    return tmp
  }
  static dimQuantize(r) {
    if (isSpecial("Quantity")) return r[""].slice(1)
    if (Number.isInteger(r)) return r, null, null
    throw "could not quantize"
  }
  constructor(v, dim, quant) {
    if (type(dim) === 'string') dim = str2dim(dim)
    this[""] = ["Quantity", new Fraction(v), dim, quant]
  }
  checkQuanta(q) {
    if (q == null || this[''][3] == null) return 1;
    if (q !== this.q) throw "incompatible quanta"
  }
  toString() {
    return str(this[''][1]) + (this[''][2] ? ' ' + dim2str(this[''][2]) : '') + (this[''][3] ? ' ' + str(this[''][3]) : '');
  }
  //TODO: math ops on Quantity
}

//TODO for vsmf
//class MimeVal
//class MimeVal2
//class UForm

function createGUID() {
  let guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    /*eslint-disable*/
    let r = Math.random() * 16 | 0,
      v = c == 'x' ? r : (r & 0x3 | 0x8);
    /*eslint-enable*/
    return v.toString(16);
  });

  return guid;
}

class UUID {
  constructor(uus) {
    if (typeof uus === 'undefined') {
      uus = createGUID();
    } else if (isSpecial(uus) == "UUID") {
      uus = uus[""][1];
    } else if (!isString(uus)) {
      if (!uus.toString) {
        throw "not a string";
      }
      uus = uus.toString();
    }
    //TODO implement binary form conversion to hexify bin data
    this[""] = ["UUID", uus];
    Object.freeze(this);
  }
  static isa(uu) {
    return isSpecial(uu) == "UUID";
  }
  toString() {
    return this[""][1];
  }
}

function toUTF8Array(str) {
  var utf8 = [];
  for (var i = 0; i < str.length; i++) {
    var charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
    // surrogate pair
    else {
      i++;
      // UTF-16 encodes 0x10000-0x10FFFF by
      // subtracting 0x10000 and splitting the
      // 20 bits of 0x0-0xFFFFF into two halves
      charcode =
        0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }
  return utf8;
}

function UTF8ArrayToStr(array) {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while (i < len) {
    c = array[i++];
    switch (c >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12:
      case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
        );
        break;
    }
  }
  return out;
}

function eint(i) {
  function push_n(a, i, n) {
    while (n > 0) {
      n -= 8;
      a.push((i >> n) & 0xff);
    }
  }
  if (i < 0) {
    throw Error("negative");
  }
  var a = [];
  if (i < 0xfc) {
    a.push(i);
  } else if (i < 0xffff) {
    a.push(0xfc);
    push_n(a, i, 16);
  } else if (i < 0xffffffff) {
    a.push(0xfd);
    push_n(a, i, 32);
  } else if (i < 0xffffffffffffffff) {
    a.push(0xfd);
    push_n(a, i, 64);
  } else {
    throw Error("too big");
  }
  return a;
}

function asString(a) {
  return typeof a == "string" ? a : "" + a;
}

function asNumber(a) {
  return x === null ? NaN : +a; //was: Number(a);
}

var classByName = { 'UUID': UUID, 'Binary': Binary, 'Date': DateValue };
function parseJSON(a) {
  return JSON.parse(a, function (k, v) {
    var c;
    return (v[''] && (c = classByName[v[''][0]]) && Object.keys(v).length == 1) ? (new c(v)) : v;
  });
};

function deepFreezeAndClassify(o) {
  var p = Object.getOwnPropertyNames(o);
  p.forEach(function (prop) {
    if (o.hasOwnProperty(prop)
      && o[prop] !== null
      && (typeof o[prop] === "object" || typeof o[prop] === "function")
      && !Object.isFrozen(o[prop])) {
      deepFreezeAndClassify(o[prop]);
    }
  });
  if (p.length === 1 && p[0] === '' && Array.isArray(o[''])) {
    var c = classByName[o[''][0]];
    if (c && o.__proto__ === Object.prototype) o.__proto__ = c.prototype;
  }
  Object.freeze(o);
  return o;
};

export default {
  isSpecial,
  isString,
  UUID,
  Binary,
  deepEdit,
  deepFreeze,
  deepFreezeAndClassify,
  stringifyKeysInOrder,
  shallowCopy,
  orderedJSON,
  parseJSON,
  deepMergeUpdates,
  UTF8ArrayToStr,
  toUTF8Array,
  asString,
  asNumber,
  DateValue,
  isValidDate
};
