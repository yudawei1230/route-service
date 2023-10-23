// docker stop browser && docker rm -v browser && docker rmi pptr-image && docker build --tag=pptr-image . && docker run -td --name browser -p 8833:8833 -p 8822:8822  pptr-image
// docker run -td --name browser --network host  pptr-image
const puppeteer = require('puppeteer');
const fs = require('fs');
const reqList = new Set();
let browserId = '';
let targetPage;
(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--remote-debugging-address=0.0.0.0',
      '--remote-debugging-port=8822',
    ],
  });
  targetPage = await browser.newPage();
  await targetPage.goto('https://www.amazon.com/');
  const browserWSEndpoint = browser.wsEndpoint();
  browserId = browserWSEndpoint.split('/').pop();

  setInterval(async () => {
    await targetPage.reload();
  }, 1000 * 60 * 30);

  fs.writeFileSync('./id.txt', browserId);
})();

async function getCrid(keyword) {
  // 获取当前页面的URL
  if (!targetPage) return;
  const currentUrl = await targetPage.url();

  if (currentUrl.includes('?')) {
    await targetPage.goBack();
  }
  if (!currentUrl.includes('https://www.amazon.com')) return;

  await targetPage.waitForSelector('input[name=field-keywords]');

  let resolve;
  const responseHandler = async response => {
    const url = response.url();
    const status = response.status();

    if (
      url.match(/\/suggestions\?/) &&
      url.includes('prefix=' + encodeURIComponent(keyword)) &&
      status === 200
    ) {
      try {
        const body = await response.text(); // 或使用 response.buffer() 方法
        const data = JSON.parse(body);
        if (decodeURIComponent(data.prefix) === decodeURIComponent(keyword)) {
          resolve && resolve('crid=' + data.responseId);
        }
      } catch (e) {}
    }
  };

  targetPage.on('response', responseHandler);
  targetPage.click('input[name="field-keywords"]');
  await targetPage.keyboard.down('Control'); // 按下 Control 键
  await targetPage.keyboard.press('A'); // 按下 A 键，选中所有文本
  await targetPage.keyboard.up('Control'); // 释放 Control 键
  await targetPage.keyboard.press('Backspace'); // 按下删除键，清空输入框的值
  await targetPage.type(
    'input[name="field-keywords"]',
    decodeURIComponent(keyword)
  );
  setTimeout(() => {
    resolve('');
  }, 3000);
  const crid = await new Promise(r => (resolve = r));
  targetPage.removeListener('response', responseHandler);

  return crid;
}

const http = require('http');
const caches = {};
const server = http.createServer(async (req, res) => {
  if (req.url.split('?')[0] === '/getCrid' && req.method === 'GET') {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const keyword = urlParams.get('keyword');
    // 在这里可以对关键字进行处理或其他操作
    const cb = async cacheCrid => {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      const crid = cacheCrid || (await getCrid(keyword));

      res.end(JSON.stringify({ status: 200, keyword, crid }));

      if (!cacheCrid) {
        if (crid) {
          caches[keyword] = crid;
          setTimeout(() => {
            delete caches[keyword];
          }, 5000);
        }

        reqList.delete(cb);
        console.log(reqList.size);
        if (reqList.size > 0) {
          const iterator = reqList.values();
          const headCb = iterator.next().value;
          headCb();
        }
      }
    };
    if (caches[keyword]) {
      return cb(caches[keyword]);
    }
    reqList.add(cb);
    if (reqList.size === 1) {
      cb();
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
});

server.listen(8833, () => {
  console.log('Server is running on port 8833');
});
