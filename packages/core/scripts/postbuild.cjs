const fs = require("fs")
const path = require("path")

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

function copyDir(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) return
  fs.mkdirSync(toDir, { recursive: true })
  for (const ent of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const from = path.resolve(fromDir, ent.name)
    const to = path.resolve(toDir, ent.name)
    if (ent.isDirectory()) copyDir(from, to)
    else if (ent.isFile()) copyFile(from, to)
  }
}

function rewriteFile(filePath, replacers) {
  const content = fs.readFileSync(filePath, "utf8")
  let next = content
  for (const [from, to] of replacers) next = next.replace(from, to)
  if (next !== content) fs.writeFileSync(filePath, next, "utf8")
}

function mustExist(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing build output: ${p}`)
}

function createCjsReplacers(deps) {
  const replacers = []
  for (const dep of deps) {
    replacers.push(
      [new RegExp(`require\\(\"\\./${dep}\"\\)`, "g"), `require('./${dep}.cjs')`],
      [new RegExp(`require\\('\\./${dep}'\\)`, "g"), `require('./${dep}.cjs')`]
    )
  }
  return replacers
}

function createEsmReplacers(deps) {
  const replacers = []
  for (const dep of deps) {
    replacers.push(
      [new RegExp(`from\\s+\"\\./${dep}\"`, "g"), `from './${dep}.mjs'`],
      [new RegExp(`from\\s+'\\./${dep}'`, "g"), `from './${dep}.mjs'`]
    )
  }
  return replacers
}

function createRewriteTasks(entryDeps) {
  const tasks = []
  for (const [entry, deps] of Object.entries(entryDeps)) {
    if (!deps.length) continue
    tasks.push(
      { file: `${entry}.cjs`, replacers: createCjsReplacers(deps) },
      { file: `${entry}.mjs`, replacers: createEsmReplacers(deps) }
    )
  }
  return tasks
}

const root = process.cwd()
const dist = path.resolve(root, "dist")

const entries = ["index", "assets", "vite-assets", "editor", "controlled", "react", "vue"]
for (const name of entries) {
  const requiredPairs = [
    [
      path.resolve(dist, "types", `${name}.d.ts`),
      path.resolve(dist, `${name}.d.ts`)
    ],
    [path.resolve(dist, "cjs", `${name}.js`), path.resolve(dist, `${name}.cjs`)],
    [path.resolve(dist, "esm", `${name}.js`), path.resolve(dist, `${name}.mjs`)]
  ]
  for (const [from, to] of requiredPairs) {
    mustExist(from)
    copyFile(from, to)
  }

  const esmMapFrom = path.resolve(dist, "esm", `${name}.js.map`)
  if (fs.existsSync(esmMapFrom)) {
    copyFile(esmMapFrom, path.resolve(dist, `${name}.js.map`))
  }
}

const rewriteTasks = createRewriteTasks({
  index: ["assets", "editor", "controlled"],
  "vite-assets": ["assets"],
  editor: ["assets"],
  controlled: [],
  react: ["editor"],
  vue: ["editor"]
})

for (const t of rewriteTasks) {
  rewriteFile(path.resolve(dist, t.file), t.replacers)
}

copyDir(
  path.resolve(root, "assets", "yuque-assets"),
  path.resolve(dist, "yuque-assets")
)
