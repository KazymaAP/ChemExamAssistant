import fs from 'node:fs';
const required = ['index.html', 'styles.css', 'app.js', 'config.js', 'data/questions.js'];
for (const file of required) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing file: ${file}`);
  }
}
console.log('SMOKE_OK');
