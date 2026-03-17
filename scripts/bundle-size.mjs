import fs from 'node:fs';
const files = ['index.html', 'styles.css', 'app.js'];
const size = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
const kb = Math.round((size / 1024) * 100) / 100;
console.log(`Bundle size: ${kb} KB`);
if (kb > 300) {
  console.warn('Bundle size budget exceeded (300 KB).');
}
