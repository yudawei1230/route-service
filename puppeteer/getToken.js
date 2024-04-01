//docker stop token-browser  && docker rmi token-browser && docker build -t token-browser -f ./GetTokenDockerfile . && docker run -d --rm --name token-browser -v $(pwd):/app  -p 8855:8855 token-browser && docker logs -f token-browser

//docker stop token-browser  && docker rmi token-browser && docker build -t token-browser -f ./GetTokenDockerfile . && docker run -d --rm --name token-browser -v E:\\work\\ec-route-service\\puppeteer:/app  -p 8855:8855 token-browser && docker logs -f token-browser

//docker stop token-browser  && docker rmi token-browser && docker build -t token-browser -f ./GetTokenDockerfile . && docker run -d --rm --name token-browser -v E:\\work\\ec-route-service\\puppeteer:/app  --network host token-browser && docker logs -f token-browser

const puppeteer = require('puppeteer');
const fs = require('fs')
const updateCookie = require('./updateCookie')
let cookiesList = []

try {
  const f = fs.readFileSync('./cookies.txt').toString()
  cookiesList = JSON.parse(f)
} catch(e) {
  console.log(e)
  cookiesList = []
}

function cookieIsLatest() {
  if(cookiesList.length !== 50) return false
  const last = cookiesList[49]?.[0]
  if(!last?.time) return false
  if((Date.now() - last.time) < 60 * 1000 * 30) {
    return last
  }
  return false
}

let updateTime = 0
let startTime = Date.now()
let loginSuccessTime = 0
let loginFailedTime = 0
async function reLogin(targetPage) {
  const isPageClosed = await targetPage.isClosed();
  if(isPageClosed) return 
  const session = (await targetPage.cookies()).find(
    v => v.name === 'session-id' && v.domain === '.amazon.com'
  );
  if (!session) {
    setTimeout(() => reLogin(targetPage), 3000);
    return 
  }

  const cookies = await targetPage.cookies()
  for(const item of cookies) {
    if(item.name.includes('session')) {
      await targetPage.deleteCookie(item)
    }
  }
  
  try {
    await targetPage.goto('https://www.amazon.com/');
    targetPage.waitForSelector('.a-text-right')
    .then(async () => {
      const tryDiffImage = await targetPage.evaluate(() => {
        const btn = document.querySelector('.a-text-right')
        if (btn && btn.innerText === 'Try different image') {
          return true
        }
        return false
      });
      if(tryDiffImage) {
        targetPage.click('.a-text-right').catch(() => {});
      }
    })
    .catch(() => {})
    let isReLogin
    const loadTimeout = setTimeout(() => {
      isReLogin = true
      reLogin(targetPage)
    },3000)
    await targetPage.waitForSelector('#glow-ingress-line2').catch(() => {});
    if(isReLogin) return 
    clearTimeout(loadTimeout)
    const clickAction = async () => {
      await targetPage.click('#nav-global-location-data-modal-action')
    }
    
    clickAction()
    const timeout = setInterval(clickAction, 3000);
    await targetPage.waitForSelector('#GLUXZipUpdateInput').finally(() => {
      clearInterval(timeout)
    });
    await targetPage.click('#GLUXZipUpdateInput');
    await new Promise(resolve => setTimeout(resolve, 1000))
    await targetPage.evaluate(() => {
      const input = document.getElementById('GLUXZipUpdateInput');
      if (input) {
        input.value = '10111'
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000))
    await targetPage.click('#GLUXZipUpdate').catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 1000))
    await targetPage.reload();
    await targetPage.waitForSelector('#glow-ingress-line2');
    const isRightLoc = await targetPage.evaluate(() => {
      const dom = document.getElementById('glow-ingress-line2')
      return dom && dom.innerText.includes('New York 10111‌');
    });
    if(!isRightLoc) {
      console.log('错误地址重新登录')
      loginFailedTime++
      return reLogin(targetPage);
    } else {
      loginSuccessTime++
      const cookies = await targetPage.cookies()
      if(cookies && cookies.filter(Boolean).length) {
        cookiesList.length = 49
        cookiesList.unshift(cookies.map(v => ({ name: v.name, value: v.value, domain: v.domain, time: Date.now() })))
      }
      fs.writeFile('./cookies.txt', JSON.stringify(
        cookiesList.filter(Boolean)
      ), (err) => {
        ++updateTime
        const usedTime = ((Date.now() - startTime) / (1000 * 60)).toFixed(2)
        if(!err) console.log(updateTime, ' setCookies success ' + new Date().toLocaleString(), `耗时: ${usedTime}min`)
        else console.log(err.message)
      })
      const isLatest = cookieIsLatest()
      if(isLatest) {
        setTimeout(() => {
          updateCookie('localhost', 8833)
          updateCookie('localhost', 8833)
        }, 3000)
        return console.log('此轮更新完成', new Date().toLocaleString())
      }
      reLogin(targetPage)
    }
  } catch(e) {
    loginFailedTime++
    console.log('failed', e.message)
    await new Promise(resolve =>
      setTimeout(() => resolve(reLogin(targetPage)), 1000)
    );
  }
};

async function start() {
  try {
    updateTime = 0
    startTime = Date.now()
    const tokenBrowser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--remote-debugging-address=0.0.0.0',
        '--remote-debugging-port=8855',
        // '--proxy-server=http://host.docker.internal:10809',
      ],
    });
    targetPage = await tokenBrowser.newPage();
    for(const item of cookiesList?.[0] || []) {
      await targetPage.setCookie({
        ...item,
        path: '/',
      }); 
    }

    await targetPage.goto('https://www.amazon.com/');

    setTimeout(() => reLogin(targetPage), 5000);

    return async () => {
      try {
        await targetPage.close()
        await tokenBrowser.close()
      } catch(e) {}
    }
  } catch (e) {
    console.log(e)
  }
}


let stop = start()
setInterval(async () => {
  console.log('重启puppeteer获取token')
  stop = await stop
  await stop()
  const isLatest = cookieIsLatest()
  if(isLatest) {
    return console.log('cookie是最新的，最晚更新时间为', new Date(isLatest.time).toLocaleString())  
  }
  stop = start()
}, 1000 * 60 * 5)