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

console.log(await test_grql())
