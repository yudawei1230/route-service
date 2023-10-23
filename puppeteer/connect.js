const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint:
      'ws://localhost:9222/devtools/browser/8c209754-81f5-40ce-9fca-7411ee4dd849root@b3e911f720c2',
  });
  const pages = await browser.pages();
  console.log(await pages[1].url);
  const t = await pages[1].evaluate(() => {
    document.getElementById('nav-search-submit-button').click();
    return document.title;
  });
  console.log(t);
})();
