const os = require('os');
const fs = require('fs');
const path = require('path');

// 1. Find the current Local IP
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const currentIp = getLocalIp();
console.log(`\x1b[32m[Auto-IP] Your current IP is: ${currentIp}\x1b[0m`);

// 2. Paths to .env files
const beEnvPath = path.join(__dirname, 'pakiship_be-mobile', '.env');
const feEnvPath = path.join(__dirname, 'pakiship_fe-mobile', 'pakiship_mobile_fe-main', '.env');

// 3. Update Frontend .env
if (fs.existsSync(feEnvPath)) {
    let content = fs.readFileSync(feEnvPath, 'utf8');
    content = content.replace(/EXPO_PUBLIC_API_BASE_URL=http:\/\/[0-9.]+:4000\/api/g, `EXPO_PUBLIC_API_BASE_URL=http://${currentIp}:4000/api`);
    content = content.replace(/API_BASE_URL=http:\/\/[0-9.]+:4000\/api/g, `API_BASE_URL=http://${currentIp}:4000/api`);
    fs.writeFileSync(feEnvPath, content);
    console.log(`\x1b[36m[Auto-IP] Updated Frontend .env to ${currentIp}\x1b[0m`);
}

console.log(`\x1b[33m[Auto-IP] Done! Now run your app as usual.\x1b[0m`);
