const puppeteer = require('puppeteer');
const { loopUpdateAsinHrefList, getAsyncCrid } = require('./utils/getInfo');

let page
let launched, browser, targetPage

async function createBrowser(id) {
    page = null
    try {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-service-workers',
                '--remote-debugging-address=0.0.0.0',
                '--remote-debugging-port=' + process.env.browser_port,
            ],
            });
        targetPage = await browser.newPage();
        await targetPage.goto('https://www.amazon.com/')
        await new Promise(resolve => setTimeout(resolve, 1000))
        launched = await loopUpdateAsinHrefList(targetPage)
    } catch(e) {
        if(targetPage) {
            await targetPage.close()
        }
        if(browser) {
            await browser.close()
        }
        console.log(e, '失败')
        process.send(JSON.stringify({ id, status: 200, type: 'error' }));
    }

  if(launched) {
    page = targetPage
    process.send(JSON.stringify({ id, status: 200, type: 'start' }));
  } else {
    if(targetPage) {
        await targetPage.close()
    }
    if(browser) {
        await browser.close()
    }
    await new Promise(resolve => setTimeout(() => resolve(createBrowser(id))), 1000)
  }
}

(async() => {
    process.on('SIGTERM', async function() {
        if(targetPage) {
            await targetPage.close()
        }
        if(browser) {
            await browser.close()
        }
        process.exit(0);
    });

    process.on('message', async (dataStr) => {
        try { 
            const data = JSON.parse(dataStr)
            if(data?.type === 'start') {
                return createBrowser(data.id)
            } else if(data.keyword && data.asin && data.brand) {
                const keyword = data.keyword
                const res = await getAsyncCrid(page, data.keyword, data.asin, data.brand)
                res.keyword = keyword
                process.send(JSON.stringify({ status: 200, type: 'res', id: data.id, res }));
            }
        } catch(e) {
            console.error(e)
        }
    });
})()