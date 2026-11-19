const fs = require('fs');
const path = require('path');

const distMainPath = path.join(__dirname, '..', 'dist', 'main.js');
const distSrcMainPath = path.join(__dirname, '..', 'dist', 'src', 'main.js');

if (fs.existsSync(distSrcMainPath) && !fs.existsSync(distMainPath)) {
  fs.writeFileSync(distMainPath, "require('./src/main');\n", 'utf8');
  console.log('Created dist/main.js entrypoint shim pointing to dist/src/main.js');
}
