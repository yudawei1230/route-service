// docker stop browser && docker rm -v browser && docker rmi pptr-image && docker build --tag=pptr-image . && docker run -td --name browser -p 8833:8833 -p 8822:8822  pptr-image && docker logs -f browser
// docker stop browser && docker rm -v browser && docker rmi pptr-image && docker build --tag=pptr-image . && docker run -td --name browser --network host  pptr-image && docker logs -f browser
const puppeteer = require('puppeteer');
const startServer = require('./utils/server');
const { startLoop } = require('./utils/queue');
let browserId = '';
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
    const browserWSEndpoint = browser.wsEndpoint();
    browserId = browserWSEndpoint.split('/').pop();

    let reloadResult = true;
    targetPage.intervalReload = () => {
      if (reloadResult) return reloadResult;
      reloadResult = targetPage.reload();
      return reloadResult;
    };

    startLoop(targetPage);
    setInterval(async () => {
      reloadResult = null;
    }, 1000 * 60 * 30);

    startServer(targetPage);
  } catch (e) {
    console.log(e)
  }
})();
