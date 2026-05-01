const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  
  // Inject axe
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  
  // Run axe
  const results = await page.evaluate(async () => {
    return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
  });
  
  console.log("VIOLATIONS:");
  results.violations.forEach(v => {
    console.log(`- [${v.id}] ${v.help}`);
    v.nodes.forEach(n => console.log(`   Element: ${n.html}`));
  });
  
  await browser.close();
})();
