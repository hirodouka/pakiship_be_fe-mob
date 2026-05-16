const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  let content = fs.readFileSync(envPath, 'utf8');
  
  // Update both EXPO_PUBLIC_API_BASE_URL and API_BASE_URL
  const updatedContent = content.replace(
    /(EXPO_PUBLIC_API_BASE_URL=http:\/\/)[^:]+(:4000\/api)/g,
    `$1${localIp}$2`
  ).replace(
    /(API_BASE_URL=http:\/\/)[^:]+(:4000\/api)/g,
    `$1${localIp}$2`
  );

  fs.writeFileSync(envPath, updatedContent);
  console.log(`✅ [PakiShip] .env updated with dynamic IP: ${localIp}`);
} else {
  console.error('❌ [PakiShip] .env file not found!');
}
