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
    Object.keys(unordered).sort().forEach(function(key) {
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
  if(Array.isArray(o)) {
    return "["+ o.map(orderedJSON).join(',')+"]";
  } else if(!isSpecial(o) && typeof o === 'object') {
    return "{"+Object.entries(o).map(function(a,b) { return '"' + a + '":' + orderedJSON(b); }).sort().join(",") + "}";
  } else {
    return JSON.stringify(o);
  }
}

// return an object that is equivalent to 'new_obj' but shares (recursively) any shared
// object references with 'orig'.  (This is useful in Redux reducers to minimize object
// reference changes)
function deepMergeUpdates(new_obj,orig) {
  function M(n, o) {
    if(n === o) return o;
    if(typeof n !== typeof o) return n;
    if(n instanceof Date) {
      if(o instanceof Date && n.valueOf() == o.valueOf()) return o;
      return n;
    }
    if (Array.isArray(n)) {
      if(Array.isArray(o)) {
        let mut;
        for(var i in n) {
          if(mut) {
            mut[i] = M(n[i],o[i]);
          } else {
            let newc = M(n[i],o[i]);
            if(newc !== o[i]) {
              mut = o.slice(0,n.length);
              mut[i] = newc;
            }
          }
        }
        return mut ? mut : (n.length == o.length ? o : o.slice(0,n.length));
      }
      return n;
    } else if(typeof n === 'object') {
      let mut = false;
      let n2 = {...n};
      let count = 0;
      for(var k in n2) {
        count += 1;
        let newc = n2[k] = M(n2[k],o[k]);
        if(!mut && newc !== o[k]) mut = true;
      }
      return (mut || Object.keys(o).length !== count) ? n2 : o;
    } else {
      return n;
    }
  }
  return M(new_obj,orig);
}

function deepFreeze (o) {
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
  return (a[""] && Object.keys(a).length == 1) ? a[""][0] : undefined;
}

ErrTok = deepFreeze({"":["ErrTok"]});

Null = deepFreeze({"":["Null"]}); //NOT js 'null'

class Binary {
  constructor(data) { //from
    if(isSpecial(data) == "Binary") {
      data = data[""][1];
    } else if(!isString(data)) {
      throw Error("TBD: non base64 data");
    }
    this[""] = ["Binary",data];
    deepFreeze(this);
  }
  static isa(uu) {
    return isSpecial(uu) == "Binary";
  }
}

//TODO for vsmf
//class MimeVal
//class MimeVal2
//class Date
//class Quantity
//class Ratio
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
    if(typeof uus === 'undefined') {
      uus = createGUID();
    } else if(isSpecial(uus) == "UUID") {
      uus = uus[""][1];
    } else if(!isString(uus)) {
      if(!uus.toString) {
        throw "not a string";
      }
      uus = uus.toString();
    }
    //TODO implement binary form conversion to hexify bin data
    this[""] = ["UUID",uus];
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

var classByName = {'UUID':UUID, 'Binary':Binary};
function parseJSON(a) {
  return JSON.parse(a,function(k,v) {
    var c;
    return (v[''] && (c = classByName[v[''][0]]) && Object.keys(v).length == 1) ? (new c(v)) : v;
  });
};

function deepFreezeAndClassify (o) {
  var p = Object.getOwnPropertyNames(o);
  p.forEach(function (prop) {
    if (o.hasOwnProperty(prop)
        && o[prop] !== null
        && (typeof o[prop] === "object" || typeof o[prop] === "function")
        && !Object.isFrozen(o[prop])) {
      deepFreezeAndClassify(o[prop]);
    }
  });
  if(p.length === 1 && p[0] === '' && Array.isArray(o[''])) {
    var c = classByName[o[''][0]];
    if(c && o.__proto__ === Object.prototype) o.__proto__ = c.prototype;    
  }
  Object.freeze(o);
  return o;
};

module.exports = {
  isSpecial,
  isString,
  UUID,
  Binary,
  deepFreeze,
  deepFreezeAndClassify,
  stringifyKeysInOrder,
  orderedJSON,
  parseJSON,
  deepMergeUpdates,
  UTF8ArrayToStr,
  toUTF8Array,
  asString,
  asNumber
};
