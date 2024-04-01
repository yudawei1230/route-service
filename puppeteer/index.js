
const puppeteer = require('puppeteer');
const startServer = require('./utils/server');
const { startLoop } = require('./utils/queue');
const { syncReLogin, loopUpdateAsinHrefList } = require('./utils/getInfo');
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
    await targetPage.goto('https://www.amazon.com/');

    let reloadResult = true;
    targetPage.intervalReload = () => {
      if (reloadResult) return reloadResult;
      reloadResult = targetPage.reload();
      return reloadResult;
    };

    startLoop(targetPage);
    setInterval(async () => {
      reloadResult = null;
    }, 1000 * 60 * 10);

    syncReLogin(targetPage)
    setTimeout(() => loopUpdateAsinHrefList(targetPage), 30000);
    startServer(targetPage);
  } catch (e) {
    console.log(e)
  }
})();
