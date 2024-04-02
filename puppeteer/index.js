
const puppeteer = require('puppeteer');
const startServer = require('./utils/server');
const { loopUpdateAsinHrefList } = require('./utils/getInfo');
let targetPage;

(async () => {
  try {
    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--remote-debugging-address=0.0.0.0',
        '--remote-debugging-port=8822',
        // '--proxy-server=http://host.docker.internal:10809',
      ],
    });
    targetPage = await browser.newPage();
    loopUpdateAsinHrefList(targetPage)
    // await targetPage.goto('https://www.amazon.com/')
    startServer(targetPage);
  } catch (e) {
    console.log(e)
  }
})();
