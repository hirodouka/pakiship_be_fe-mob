const fs = require('fs');

const path = "c:\\Users\\Bopbopgurl\\Downloads\\pakiship_be_fe-main\\pakiship_be_fe-main\\pakiship_fe-mobile\\pakiship_mobile_fe-main\\src\\features\\profile\\screens\\EditProfileScreen.tsx";
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < 20; i++) {
  console.log(`Line ${i + 1}: ${JSON.stringify(lines[i])}`);
}
