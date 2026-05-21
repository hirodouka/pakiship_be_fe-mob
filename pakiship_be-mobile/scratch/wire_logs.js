const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

console.log('Wiring codebase to parcel.parcel_activity_logs...');

walkDir(srcDir, (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  content = content.replace(/\.schema\("account"\)\s*\.\s*from\("customer_activity_logs"\)/g, '.schema("parcel").from("parcel_activity_logs")');
  content = content.replace(/\.schema\('account'\)\s*\.\s*from\('customer_activity_logs'\)/g, ".schema('parcel').from('parcel_activity_logs')");
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[Wired Logs] ${path.relative(srcDir, filePath)}`);
  }
});

console.log('Logs wiring complete!');
