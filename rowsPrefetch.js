//extract symbols and member dotted syms from expr parse
function parsed_symbols(p) {
  const syms = []
  function joinMember(n) {
    if(n.property.type === "Identifier") {
      if(n.object.type === "Identifier") return n.object.name + "." + n.property.name
      else if(n.object.type === "MemberExpression") {
        return joinMember(n) + "." + n.property.name
      }
    }
    throw "bad expr"
  }
  function node_symbol(n, syms, unique=true) {
    switch(n.type) {
      case "MemberExpression":
        const name = joinMember(n)
        if(!unique || syms.indexOf(name) < 0)
          syms.push(name)
        break
      case "Identifier":
        if(!unique || syms.indexOf(n.name) < 0)
          syms.push(n.name)
        break
      case "UnaryExpression":
        node_symbol(n.argument, syms, unique)
        break
      case "LogicalExpression":
      case "BinaryExpression":
        node_symbol(n.left, syms, unique)
        node_symbol(n.right, syms, unique)
        break
      case "CallExpression":
        n.arguments.map(p => node_symbol(syms, unique))
        break
      case "ArrayExpression":
        n.elements.map(p => node_symbol(syms, unique))
        break
    }
  }
  node_symbol(p, syms)
  return syms
}

async function rowsPrefetch(syms) { //make sure cache is full of uforms for paths in syms
  console.log("PRE",syms, rows)
  const toDo = syms.reduce((ret, s) => { 
    return rows.reduce((ret, r) => {
      const path = s.split(".")
      if(path.length > 1 && colName.hasOwnProperty(path[0])) {
        const v = r[colName[path[0]]]
        if(v) {
          path.splice(0,1)
          ret.push([path,v])
        }
      }
      return ret
    }, ret) 
  }, []);
  // todo = [[path_list, value],...]
  const toFetch = []
  while(toDo.length > 0) {
    let j = 0;
    for(let i=0; i<toDo.length; i++) {
      const s = toDo[i][0]
      let v = toDo[i][1]
      while(s.length > 0) {
        if(v == null) break
        if(isReference(v)) {
          const found = findReference(v)
          if(found === undefined) {
            toFetch.push(v)
            break
          }
          v = found
        } else if(Array.isArray(v) && isReference(v[0])) {
          
          
          toFetch.extend(v.filter(isReference))
          break
        }
        //what about following multiple paths!!! todo:
        v = v[s[0]]
        s.splice(0,1)
        toDo[i][1] = v
      }
      if(s.length > 0 && v) {
        toDo[j++] = toDo[i]
      }
    }
    toDo.length = j;
    if(toFetch.length > 0) {
      await fetchReferences(toFetch)
      toFetch.length = 0
    }
  }
}
