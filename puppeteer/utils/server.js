const http = require('http');
const fs = require('fs')
const p = require('path')
const { getAsyncCrid, loadCookies } = require('./getInfo');
const { updateAsinList, updateRankTask } = require('./updateRankTask');
const caches = {};

async function getCrid({ res, urlParams, targetPage }) {
  const keyword = urlParams.get('keyword');
  const asin = urlParams.get('asin');
  const brand = urlParams.get('brand');
  // 在这里可以对关键字进行处理或其他操作
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  const cacheKy = `${keyword}_${asin}`;
  const keywordCache = caches[cacheKy];
  if (keywordCache) {
    return res.end(JSON.stringify({ status: 200, keyword, ...keywordCache }));
  }
  const keywordInfo = await getAsyncCrid(targetPage, keyword, asin, brand);

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
      caches[cacheKy] = keywordInfo;
      setTimeout(() => {
        delete caches[cacheKy];
      }, 5000);
    }
  }
}

function startServer(targetPage) {
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

    if(path === '/setCookies' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const list = data.list;
            fs.writeFileSync(p.resolve(__dirname, '../cookies.txt'), JSON.stringify(list));
            loadCookies()
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                status: 200,
              })
            );
          } catch(e) {
            console.log(e.message)
            JSON.stringify({
              status: 500,
              message: e.message
            });
          }
        });

        return 
    }

    res.statusCode = 404;
    res.end();
  });

  server.listen(8833, () => {
    console.log('Server is running on port 8833');
    // updateRankTask(targetPage, true);
  });
};

module.exports = startServer
