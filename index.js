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

//util: async version of filter in place
async function filterInPlace(a, condition) {
  let i = 0, j = 0;
  while (i < a.length) {
    const val = a[i];
    if (await condition(val)) a[j++] = val;
    i++;
  }
  a.length = j;
  return a;
}

//GrQL - search through a graph of JS objects (possibly with external references)
//
//query.path: ":named_root.relation1:name1.relation2:name2.unname_relation.relation4:name4"
//query.path: "relation1.relation2.relation3:result"
//query.where: "name1.qwerty = 4"
//query.sortBy: "name2.name"
//query.return: "name4" -- note: how do we handle unique-ifying return values?

//options: cache.isReference(a) -> true/false
//              .fetchReferences(aList) -> Promise()
//              .resolveReference(a) -> value

//const Parser = require('@senn/expr-eval').Parser;
//const parser = new Parser({overrideMember:member})

const parser = require('jsep')
parser.removeIdentifierChar('@');
parser.removeIdentifierChar('_');
parser.addBinaryOp('contains'); //this SEEMS to work...
parser.addBinaryOp('contains1of'); //this SEEMS to work... set intersection positive
const contains = (a, b) => a.indexOf(b) >= 0 || a.hasOwnProperty(b)
const binOps = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '&&': (a, b) => a && b,
  '||': (a, b) => a || b,
  '==': (a, b) => a == b,
  '===': (a, b) => a === b,
  'contains': contains,
  'contains1of': (a, b) => a.map(x => contains(b, a)).any()
};
const unOps = {
  '-': a => -a,
  '+': a => +a,
  '!': a => !a,
};

function evaluate(e, vars) {
  async function doEval(node) {
    switch (node.type) {
      case 'MemberExpression':
        const name = node.computed ?
          doEval(node.property) :
          node.property.type === 'Literal' ? node.property.value :
            node.property.type === 'Identifier' ? node.property.name :
              null
        if (!name) throw "bad member expr: " + JSON.stringify(node.property)
        return doEval(node.object)[name]
      case 'ArrayExpression':
        return node.elements.map(doEval)
      case 'LogicalExpression':
      case 'BinaryExpression':
        return binOps[node.operator](doEval(node.left), await doEval(node.right));
      case 'UnaryExpression':
        return unOps[node.operator](doEval(node.argument));
      case 'Literal':
        return node.value;
      case 'Identifier':
        return vars[node.name]
    }
  }
  return doEval(e)
}

async function asyncEvaluate(e, vars, literal) {
  async function doEval(node) {
    switch (node.type) {
      case 'MemberExpression':
        const name = node.computed ?
          await doEval(node.property) :
          node.property.type === 'Literal' ? node.property.value :
            node.property.type === 'Identifier' ? node.property.name :
              null
        if (!name) throw "bad member expr: " + JSON.stringify(node.property)
        return literal(await doEval(node.object), name)
      case 'ArrayExpression':
        return Promise.all(node.elements.map(doEval))
      case 'LogicalExpression':
      case 'BinaryExpression':
        return binOps[node.operator](await doEval(node.left), await doEval(node.right));
      case 'UnaryExpression':
        return unOps[node.operator](await doEval(node.argument));
      case 'Literal':
        return node.value;
      case 'Identifier':
        return literal(null, node.name, true);
    }
  }
  return doEval(e)
}

//
// options: { 
//   allowNull = true | false
//   isReference = function(a) // is 'a' a fetchable reference
//   fetchReferences = async function(reflist) //fetch each reference in the 'reflist' (awaitable)
//   findReference = function(ref) // return the cached value for 'ref',
//                                    return undefined for not-yet-fetched, null for fetched-but-empty
// 

async function grql(startAt, query, options) {
  const isReference = (options && options['isReference']) || ((a) => false);
  const fetchReferences = options && options['fetchReferences'];
  const findReference = options && options['findReference'];

  //make a mapping table from column names to row value
  function colVars(row, colName) {
    return Object.keys(colName).reduce((ret, k) => { ret[k] = row[colName[k]]; return ret }, {});
  }

  //assumes rows is mutable and extends in place
  function extendRows(rows, follow, allowNull = false) {
    const toFetch = {}
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      //take last element out of row and attempt to follow
      const val = row && row[row.length - 1]
      const valToDeref = isReference(val) ? findReference(val) : val
      //what deRef value is now an array (of instances) -- we should extend all the rows....
      const next = valToDeref && (Array.isArray(valToDeref) ? valToDeref.map(a => a[follow]).flat() : valToDeref[follow])
      if (next && Array.isArray(next)) {
        for (let j = 0; j < next.length; j++) {
          const item = next[j]
          if (isReference(next[j])) {
            const uf = findReference(next[j])
            if (uf === undefined) {
              toFetch[next[j]] = null
            }
          }
          if (j === next.length - 1) { //optimized case
            row.push(item)
          } else {
            rows.splice(i, 0, [...row, item])
            i += 1
          }
        }
      } else if (next || allowNull) {
        if (isReference(next)) toFetch[next] = null
        row.push(next)
      } else {
        rows.splice(i, 1)
        i -= 1
      }
    }
    return Object.keys(toFetch)
  }

  //start with rows
  if (options && options['isReference']) {
    const refs = startAt.filter(isReference)
    if (refs.length > 0) { await fetchReferences(refs) }
  }
  const rows = startAt.map(a => [isReference(a) ? findReference(a) : a]) //wrap with single-column row
  const follow = query.path.split(".").map(a => a.split(":", 2))
  const colName = {}

  async function customEvalExpr(e, vars) {
    class ManyValued {
      constructor(data) {
        this.items = data;
      }
      //dereference member for each item but join all values into an array (including 1 level of subarray)
      followMemberJoin(n) {
        const ret = this.items.reduce(
          (ret, i) => {
            const v = i[n]
            if (v) {
              if (Array.isArray(v)) ret.push.apply(ret, v)
              ret.push(v)
            }
            return ret
          }, [])
        if (ret.length == 0) return null
        if (ret.length == 1) return ret[0]
        return ret
      }
    }
    async function literalAccess(v, n, isRoot) {
      if (isRoot) v = vars

      if (Array.isArray(v) && isReference(v[0])) {
        if (v.length == 1) {
          v = v[0]
        } else {
          await fetchReferences(v.filter(isReference))
          v = new ManyValued(v.map(x => isReference(x) ? findReference(x) : x))
        }
      }
      if (isReference(v)) {
        if (findReference(v) === undefined) await fetchReferences([v])
        v = findReference(v)
      }
      if (n === '') {
        //just defref: ie  expr "foo['']" is a hack to dereference foo and get whole value
      } else if (v instanceof ManyValued) {
        v = v.followMemberJoin(n)
      } else if (v) {
        v = v[n]
      } else {
        v = null
      }
      return v
    }
    return asyncEvaluate(e, vars, literalAccess)
  }

  await follow.reduce(async (ret, f, idx) => {
    if (f[1]) colName[f[1]] = idx
    if (idx > 0 || f[0] !== '') { //skip first if named
      const toFetch = extendRows(rows, f[0], query.allowNull)
      if (toFetch.length > 0) { await fetchReferences(toFetch) }
    }
  }, [])
  const where = parser(query.where)
  await filterInPlace(rows, async a => customEvalExpr(where, colVars(a, colName)));
  if (query.sortBy) {
    const sortBy = parser(query.sortBy)
    await rows.sort(async r => await customEvalExpr(sortBy, colVars(r, colName)))
  }
  const retExpr = parser(query.return)
  return Promise.all(rows.map(r => customEvalExpr(retExpr, colVars(r, colName))));
}

async function test_grql() {
  const d = { name: "d", value: "d123" }
  const e = { name: "e", value: "e123" }
  const f = { name: "f", value: "f123" }
  const a = {
    name: "a",
    q: 1,
    w: [d, e, f]
  }
  const b = {
    name: "b",
    q: 1,
    w: [e, f]
  }

  if (1) {
    const result = await grql([a, b], { path: ":start.w:varw.value:varv", where: "varw.value == 'e123'", return: "[varv, varw]" })
    console.log("RESULT", result)
    console.log("--------------------------------------------------------------")
  }

  if (1) {
    const db = { 'ref:1': 786, 'ref:e': e, 'ref:d': d, 'ref:f': f }
    const cache = {}
    const h = {
      name: "a",
      q: 1,
      w: ['ref:d', 'ref:e', 'ref:f']
    }
    const j = {
      name: "b",
      q: 1,
      w: ['ref:e', 'ref:f']
    }

    const result2 = await grql([h, j], { path: ":start.w:varw.value:varv", where: "varw.value == 'e123'", return: "[varv,varw,start.w.name, varw[varw.value] ]" }, {
      isReference: (a => typeof (a) === "string" && a.startsWith("ref:")),
      findReference: (a => cache[a]),
      fetchReferences: (async (fl) => { fl.map(a => { cache[a] = (db[a] || null) }); return true; })
    })
    console.log("RESULT2", JSON.stringify(result2))
  }
}
//test_grql();

module.exports = {
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
