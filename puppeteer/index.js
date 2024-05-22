
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
    
    targetPage.on('error', (e) => {
      process.exit()
    })
    startServer(targetPage);
    await targetPage.goto('https://www.amazon.com/')
    setTimeout(() => {
      loopUpdateAsinHrefList(targetPage)
    }, 60000)
  } catch (e) {
    console.log(e)
  }
})();

