const fs = require('fs');
const glob = require('glob');
const path = 'c:/coding_program_files/FISH_MARKET/apps/frontend/src/**/*.ts*';
const files = glob.sync(path);
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (content.includes('../ui/Button') || content.includes('../ui/Input') || content.includes('../ui/Card') || content.includes('../ui/Toast')) {
    content = content.replace(/from\s+['\"]\.\.\/ui\/[^'\"]+['\"]/g, 'from \'@fishmarket/ui\'');
    changed = true;
  }
  if (content.includes('@/components/ui/Toast')) {
    content = content.replace(/from\s+['\"]@\/components\/ui\/Toast['\"]/g, 'from \'@fishmarket/ui\'');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
}
