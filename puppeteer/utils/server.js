const http = require('http');
const { getAsyncCrid } = require('./getInfo');
const { updateAsinList, updateRankTask } = require('./updateRankTask');
const caches = {};

async function getCrid({ res, urlParams, targetPage, backupPage }) {
  const keyword = urlParams.get('keyword');
  const asin = urlParams.get('asin');
  // 在这里可以对关键字进行处理或其他操作
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  const keywordCache = caches[keyword];
  if (keywordCache) {
    return res.end(JSON.stringify({ status: 200, keyword, ...keywordCache }));
  }
  const keywordInfo = await getAsyncCrid(targetPage, backupPage, keyword, asin);

  res.end(
    JSON.stringify({
      status: 200,
      keyword,
      ...Object.assign(
        {
          crid: '',
          sprefix: '',
          refTag: '',
          href: '',
        },
        keywordInfo || {}
      ),
    })
  );

  if (!keywordCache) {
    if (keywordInfo) {
      caches[keyword] = keywordInfo;
      setTimeout(() => {
        delete caches[keyword];
      }, 5000);
    }
  }
}

module.exports = function startServer(targetPage, backupPage) {
  const server = http.createServer(async (req, res) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const path = req.url.split('?')[0];
    const method = req.method;
    console.log(path);
    if (path === '/getCrid' && method === 'GET') {
      return getCrid({ req, res, urlParams, targetPage, backupPage });
    }

    if (path === '/updateAsinList' && method === 'POST') {
      return updateAsinList({ req, res, urlParams, targetPage });
    }

    if (path === '/updateRankTask' && method === 'GET') {
      updateRankTask(targetPage, true);
      res.statusCode = 200;
      res.end('ok');
    }

    if (path === '/relogin' && method === 'GET') {
      await backupPage.deleteCookie({
        name: 'session-id',
        url: 'https://www.amazon.com',
        domain: '.amazon.com',
        path: '/',
        secure: true
      });
      await backupPage.reload();
      await backupPage.waitForSelector('#glow-ingress-line2');  
      backupPage.click('#nav-global-location-data-modal-action');
      await backupPage.waitForSelector('#GLUXZipUpdateInput');  
      backupPage.click('#GLUXZipUpdateInput');
      await backupPage.type('#GLUXZipUpdateInput', '10111');

      await backupPage.click('#GLUXZipUpdate');
      setTimeout(() => {
        backupPage.reload();
      }, 1000)
    }

    res.statusCode = 404;
    res.end();
  });

  server.listen(8833, () => {
    console.log('Server is running on port 8833');
    // updateRankTask(targetPage, true);
  });
};
