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

console.log('Starting global secure schema wiring...');

let modifiedCount = 0;

walkDir(srcDir, (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // 1. Redirect driver_jobs from parcel to driver schema
  content = content.replace(/\.schema\("parcel"\)\s*\.\s*from\("driver_jobs"\)/g, '.schema("driver").from("driver_jobs")');
  content = content.replace(/\.schema\('parcel'\)\s*\.\s*from\('driver_jobs'\)/g, ".schema('driver').from('driver_jobs')");
  
  // 2. Redirect drop_off_points from parcel to location schema
  content = content.replace(/\.schema\("parcel"\)\s*\.\s*from\("drop_off_points"\)/g, '.schema("location").from("drop_off_points")');
  content = content.replace(/\.schema\('parcel'\)\s*\.\s*from\('drop_off_points'\)/g, ".schema('location').from('drop_off_points')");
  
  // 3. Redirect parcel_hub_records from parcel to location schema
  content = content.replace(/\.schema\("parcel"\)\s*\.\s*from\("parcel_hub_records"\)/g, '.schema("location").from("parcel_hub_records")');
  content = content.replace(/\.schema\('parcel'\)\s*\.\s*from\('parcel_hub_records'\)/g, ".schema('location').from('parcel_hub_records')");
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[Wired] ${path.relative(srcDir, filePath)}`);
    modifiedCount++;
  }
});

console.log(`\nWiring complete! Successfully redirected schemas in ${modifiedCount} backend source files.`);
