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

export default {
  parser,
  evaluate,
  asyncEvaluate,
  grql,
};

