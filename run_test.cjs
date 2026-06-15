const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let crashed = false;
  page.on('console', msg => {
     if (msg.text().includes('Invalid content for node listItem')) {
         console.log('CRASH DETECTED:', msg.text());
         crashed = true;
     }
  });
  page.on('pageerror', err => {
      if (err.message.includes('Invalid content for node listItem')) {
         console.log('PAGE ERROR CRASH DETECTED:', err.message);
         crashed = true;
      }
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.ProseMirror', { state: 'attached' });

  await page.evaluate(() => {
      // simulate PluginRegistry.createNote
      window.PluginRegistry.createNote({
          title: 'Test Crash',
          content: '- [ ] ',
          subject: 'Test',
          section: 'Test',
          tags: 'test'
      });
  });

  await page.waitForTimeout(2000);
  console.log('Test completed. Crashed:', crashed);
  await browser.close();
})();
