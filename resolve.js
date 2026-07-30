const fs = require('fs');
function keepHead(file) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n[\s\S]*?>>>>>>> [^\n]+\r?\n/g, '\');
  fs.writeFileSync(file, c);
}
function keepBoth(file) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\n]+\r?\n/g, '\\');
  fs.writeFileSync(file, c);
}
function keepTheirs(file) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/<<<<<<< HEAD\r?\n[\s\S]*?=======\r?\n([\s\S]*?)>>>>>>> [^\n]+\r?\n/g, '\');
  fs.writeFileSync(file, c);
}
keepHead('src/app.module.ts');
keepBoth('.env.example');
keepBoth('prisma/schema.prisma');
keepBoth('.gitignore');
keepTheirs('src/modules/auth/__tests__/auth.controller.spec.ts');

