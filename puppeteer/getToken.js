//docker stop token-browser  && docker rmi token-browser && docker build -t token-browser -f ./GetTokenDockerfile . && docker run -d --rm --name token-browser -v $(pwd):/app  -p 8855:8855 token-browser && docker logs -f token-browser

//docker stop token-browser  && docker rmi token-browser && docker build -t token-browser -f ./GetTokenDockerfile . && docker run -d --rm --name token-browser -v E:\\work\\ec-route-service\\puppeteer:/app  -p 8855:8855 token-browser && docker logs -f token-browser

const puppeteer = require('puppeteer');
const fs = require('fs')
let cookiesList = []

try {
  const f = fs.readFileSync('./cookies.txt').toString()
  cookiesList = JSON.parse(f)
} catch(e) {
  console.log(e)
  cookiesList = []
}

let loginSuccessTime = 0
let loginFailedTime = 0
async function reLogin(targetPage) {
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
      cookiesList.length = 50
      cookiesList.unshift(cookies.map(v => ({ name: v.name, value: v.value, domain: v.domain })))
    }
    fs.writeFile('./cookies.txt', JSON.stringify(
      cookiesList.filter(Boolean)
    ), (err) => {
      if(!err) console.log('setCookies success ' + new Date().toLocaleString())
      else console.log(err.message)
    })
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

(async () => {
  try {
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
  } catch (e) {
    console.log(e)
  }
})();
