const http = require('http');
const getInfo = require('./getInfo');

const asinList = [];

exports.asinList = asinList;

function loadAsin() {
  const options = {
    hostname: 'www.etechx.top',
    port: 80,
    path: '/getLinks',
    method: 'GET',
  };

  const req = http.request(options, res => {
    let resStr = '';

    res.on('data', chunk => {
      resStr += chunk;
    });

    res.on('end', () => {
      const list = JSON.parse(resStr).data;
      asinList.length = 0;
      asinList.push(...list);
    });
  });

  req.on('error', error => {
    console.error(error);
  });

  req.end();
}

async function getRank({ targetPage, asin }) {
  const target = asinList.find(v => v.asin === asin);
  if (!target || !target.keyword) return;
  const keyword = target.keyword;
  const info = await getInfo(targetPage, target.keyword);
  if (!info || !info.crid || !info.sprefix) return;

  const result = await targetPage.evaluate(
    async info => {
      let link = null;
      let iframe = null;
      try {
        for (let i = 0; i < 20; i++) {
          if (link) {
            document.body.removeChild(iframe);
            return link;
          }
          if (i === 0) {
            const url = `https://www.amazon.com/s?k=${info.keyword}&${
              i === 0
                ? info.refTag
                  ? 'ref=' + info.refTag
                  : ''
                : 'page=' + (i + 1)
            }&${info.crid}&sprefix=${encodeURIComponent(info.sprefix)}${
              i === 0 ? '' : '&ref=sr_pg_' + (i + 1)
            }`;
            await new Promise(resolve => {
              iframe = document.createElement('iframe');
              iframe.src = url;
              iframe.style.display = 'none';
              iframe.onload = function () {
                const htmlCode =
                  iframe.contentDocument.documentElement.outerHTML;
                const match = htmlCode.match(
                  new RegExp(`(?<=href=").+?${info.asin}[^"]+`)
                );
                const rank = rank.match(
                  new RegExp(
                    `(?<=data-asin="${info.asin}") data-index="(\\d+)"`
                  )
                );
                if (match) {
                  link = {
                    url: new DOMParser()
                      .parseFromString(match[0], 'text/html')
                      .body.textContent.replace(/.*url=/, ''),
                    rank: rank ? `${i + 1}-${rank[1]}` : '',
                  };
                }
                resolve();
              };
              document.body.appendChild(iframe);
            });
          } else {
            if (link) {
              document.body.removeChild(iframe);
              return link;
            }
            if (iframe && iframe.contentWindow) {
              const url = `/s/query?${info.crid}&k=${info.keyword}&page=${
                i + 1
              }&qid=${(Date.now() / 1000).toFixed(
                0
              )}&ref=sr_pg_${i}&sprefix=${encodeURIComponent(info.sprefix)}`;
              await iframe.contentWindow
                .fetch(url, {
                  method: 'POST',
                })
                .then(v => v.text())
                .then(text => {
                  const match = text.match(
                    new RegExp(`(?<=href=\\\\?").+?${info.asin}[^"]+`)
                  );
                  const rank = rank.match(
                    new RegExp(
                      `(?<=data-asin="${info.asin}") data-index="(\\d+)"`
                    )
                  );
                  if (match) {
                    link = {
                      url: new DOMParser()
                        .parseFromString(match[0], 'text/html')
                        .body.textContent.replace(/.*url=/, ''),
                      rank: rank ? `${i + 1}-${rank[1]}` : '',
                    };
                  }
                })
                .catch(() => {});
            }
          }
          await new Promise(resolve => setTimeout(resolve, 20000));
        }
      } catch (e) {}
      document.body.removeChild(iframe);
      // /s/query?crid=1BBCIE4GNIL5M&k=cars&page=2&qid=1698646328&ref=sr_pg_1&sprefix=cars%2Caps%2C364

      return link;
    },
    { ...info, keyword, asin }
  );

  return (result || '')
    .replace(/crid=\w+&?/, '')
    .replace(/qid=\d+&?/, '')
    .replace(/sprefix=[^&]+&?/, '')
    .replace(/keywords=[^&]+&?/, '')
    .replace(/\\$/, '');
}

function updateAsinList({ req, res, targetPage }) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    const data = JSON.parse(body);
    const list = data.list;
    asinList.length = 0;
    asinList.push(...list);
    const result = await getRank({ targetPage, asin: asinList[1].asin });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 200,
        result,
      })
    );
  });
}

async function goUpdateTank(targetPage) {
  for (const item of asinList) {
    const result = await getRank({ targetPage, asin: item.asin });
    console.log(item, result);
    if (result && result.url) {
      const url = /^https:\/\//.test(result.url)
        ? result.url
        : `https://www.amazon.com/${result.url}`;
      const rank = result.rank ? `&rank=${result.rank}` : '';
      const options = {
        hostname: 'www.etechx.top',
        port: 80,
        path: `/updateRank?id=${item.id}&url=${encodeURIComponent(url)}${rank}`,
        method: 'GET',
      };
      const req = http.request(options);
      req.end();
    }
  }
}

function updateRankTask(targetPage, immediate) {
  loadAsin();
  setTimeout(
    async () => {
      await goUpdateTank(targetPage);
      updateRankTask(targetPage);
    },
    immediate ? 60 * 1000 : 60 * 60 * 1000
  );
}

exports.updateRankTask = updateRankTask;
exports.updateAsinList = updateAsinList;
exports.getRank = getRank;
exports.loadAsin = loadAsin;
