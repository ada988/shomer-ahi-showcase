const fs=require('fs');
const acorn=require(process.env.ACORN||'acorn');
const src=fs.readFileSync('beta/app.js','utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'});
const want=new Set(process.argv.slice(2));
const out=[];const found=new Set();
for(const n of ast.body){
  if(n.type==='FunctionDeclaration'&&want.has(n.id.name)){out.push(src.slice(n.start,n.end));found.add(n.id.name);}
  if(n.type==='VariableDeclaration'){for(const d of n.declarations){if(d.id.name&&want.has(d.id.name)){out.push(src.slice(n.start,n.end));found.add(d.id.name);}}}
}
for(const w of want)if(!found.has(w))out.push('// MISSING: '+w);
console.log(out.join('\n'));
