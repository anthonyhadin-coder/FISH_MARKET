const fs = require('fs');
const glob = require('glob');
const path = 'c:/coding_program_files/FISH_MARKET/apps/frontend/src/**/*.tsx';
const files = glob.sync(path);
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  // Replace imports from @/components/ui/... with @fishmarket/ui
  const regex = /from\s+['\"]@\/components\/ui\/[^'\"]+['\"]/g;
  if (regex.test(content)) {
    content = content.replace(regex, 'from \'@fishmarket/ui\'');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
}
