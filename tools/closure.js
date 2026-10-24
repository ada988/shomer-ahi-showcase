/* Dependency closure over beta/app.js top-level declarations.
   Usage: ACORN=<path to acorn> node showcase/tools/closure.js name1 name2 ...
   Prints the names to port: the seeds plus every beta top-level function/variable they reference
   that is not already provided by shared/ or showcase/host.js. */
const fs = require('fs');
const acorn = require(process.env.ACORN || 'acorn');
const walk = require(process.env.ACORN_WALK || 'acorn-walk');

const betaSrc = fs.readFileSync('beta/app.js', 'utf8');
const beta = acorn.parse(betaSrc, { ecmaVersion: 'latest', sourceType: 'script' });
const decl = new Map(); // name -> node
for (const n of beta.body) {
  if (n.type === 'FunctionDeclaration') decl.set(n.id.name, n);
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') decl.set(d.id.name, n);
}

// Names already provided elsewhere.
const provided = new Set();
const scan = (f) => {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?:^|\n)[ \t]*(?:async\s+)?function\s+([\w$]+)/g)) provided.add(m[1]);
  for (const m of s.matchAll(/(?:^|\n)[ \t]*(?:var|let|const)\s+([\w$]+)/g)) provided.add(m[1]);
  for (const m of s.matchAll(/\b(?:window|w|g)\.([\w$]+)\s*=/g)) provided.add(m[1]);
};
['shared/medical-forms.js', 'shared/core.js', 'shared/icons.js', 'showcase/host.js'].forEach(scan);

const seeds = process.argv.slice(2);
const take = new Set(seeds);
const queue = [...seeds];
const external = new Set();
while (queue.length) {
  const name = queue.pop();
  const node = decl.get(name);
  if (!node) continue;
  walk.full(node, (n) => {
    if (n.type !== 'Identifier') return;
    const id = n.name;
    if (take.has(id)) return;
    if (decl.has(id) && !provided.has(id)) { take.add(id); queue.push(id); }
    else if (decl.has(id)) external.add(id);
  });
}
console.log(JSON.stringify({ port: [...take], providedElsewhere: [...external].length }));
