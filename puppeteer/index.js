
const puppeteer = require('puppeteer');
const startServer = require('./utils/server');
const { loopUpdateAsinHrefList } = require('./utils/getInfo');
let targetPage;
const browserList = []

async function createBrowser(port) {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-service-workers',
      '--remote-debugging-address=0.0.0.0',
      '--remote-debugging-port=' + port,
      // '--proxy-server=http://host.docker.internal:10809',
    ],
  });
  targetPage = await browser.newPage();
  await targetPage.goto('https://www.amazon.com/')
  const launched = await loopUpdateAsinHrefList(targetPage)
  return launched ? targetPage : null
}

const browserMap = {
  8811: null,
  8822: null
}

async function removeBrowser(browser) {
  Object.keys(browserMap).forEach(port => {
    if(browserMap[port] === browser) {
      browserMap[port] = null
    }
  })
  const index = browserList.findIndex(v => v === browser)
  browserList.splice(index, 1)
  await browser.close()
}

async function getBrowser() {
  const list = (await Promise.all(Object.keys(browserMap).map(async port => {
    if(browserMap[port]) return browserMap[port]
    const browser = await createBrowser(port)
    if(browser) {
      browserMap[port] = browser
      return browser
    }
  }))).filter(Boolean)
  if(list?.length) return getBrowser()

  return list
}

(async () => {
  try {
    const browsers = await getBrowser()
    browserList.push(...browsers)

    async function loopBrowser() {
      const restBrowset = browserList.slice(1).filter(Boolean)?.[0]
      const currentBrowser = browserList[0]
      try {
        if(!restBrowset) {
          const browsers = await getBrowser()
          browserList.length = 0
          browserList.push(...browsers)
        } else {
          await removeBrowser(currentBrowser)
        }
      } catch(e) {}
      setTimeout(loopBrowser, restBrowset ? 60 * 1000 : 1000)
    }
    setTimeout(loopBrowser, 60 * 1000)

    startServer(browserList);
  } catch (e) {
    console.log(e)
  }
})();

