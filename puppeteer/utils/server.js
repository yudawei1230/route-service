const http = require('http');
const getInfo = require('./getInfo');
const { updateAsinList, updateRankTask } = require('./updateRankTask');
const caches = {};

async function getCrid({ res, urlParams, targetPage }) {
  const keyword = urlParams.get('keyword');
  const asin = urlParams.get('asin');
  // 在这里可以对关键字进行处理或其他操作
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  const keywordCache = caches[keyword];
  if (keywordCache) {
    return res.end(JSON.stringify({ status: 200, keyword, ...keywordCache }));
  }
  const keywordInfo = await getInfo(targetPage, keyword, asin);

  res.end(
    JSON.stringify({
      status: 200,
      keyword,
      ...Object.assign(
        {
          crid: '',
          sprefix: '',
          refTag: '',
          href: ''
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

module.exports = function startServer(targetPage) {
  const server = http.createServer(async (req, res) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const path = req.url.split('?')[0];
    const method = req.method;
    if (path === '/getCrid' && method === 'GET') {
      return getCrid({ req, res, urlParams, targetPage });
    }

    if (path === '/updateAsinList' && method === 'POST') {
      return updateAsinList({ req, res, urlParams, targetPage });
    }

    if (path === '/updateRankTask' && method === 'GET') {
      updateRankTask(targetPage, true);
      res.statusCode = 200;
      res.end('ok');
    }

    res.statusCode = 404;
    res.end();
  });

  server.listen(8833, () => {
    console.log('Server is running on port 8833');
    // updateRankTask(targetPage, true);
  });
};
