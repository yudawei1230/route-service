const http = require('http');
const getInfo = require('./getInfo');
const fs = require('fs');
const asinList = [];
const { getQueueHandler } = require('./queue');

exports.asinList = asinList;

function loadAsin() {
  const options = {
    hostname: '127.0.0.1',
    port: 8001,
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
let timeout;
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
        [...document.querySelectorAll('iframe[data-info="1"]')].forEach(v =>
          document.body.removeChild(v)
        );
        for (let i = 0; i < 20; i++) {
          if (iframe && ![...document.body.childNodes].includes(iframe)) {
            return;
          }
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
              iframe.setAttribute('data-info', '1');
              iframe.style.display = 'none';
              iframe.onload = function () {
                const htmlCode =
                  iframe.contentDocument.documentElement.outerHTML;
                const match = htmlCode.match(
                  new RegExp(`(?<=href=").+?${info.asin}[^"]+`)
                );
                const rank = htmlCode.match(
                  new RegExp(
                    `(?<=data-asin="${info.asin}") data-index="(\\d+)"`
                  )
                );
                iframe[`text${i}`] = htmlCode;
                if (match) {
                  link = {
                    url: new DOMParser()
                      .parseFromString(match[0], 'text/html')
                      .body.textContent.replace(/.*url=/, ''),
                    rank: rank ? `${i + 1}-${rank[1]}` : '',
                    text: htmlCode,
                    i,
                  };
                }
                resolve();
              };
              setTimeout(() => {
                resolve();
              }, 10000);
              console.log(iframe);
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

              const matchLink = async body => {
                if (link) return;
                return await iframe.contentWindow
                  .fetch(url, {
                    method: 'POST',
                    body,
                  })
                  .then(v => v.text())
                  .then(text => {
                    const match = text.match(
                      new RegExp(`(?<=href=\\\\?").+?${info.asin}[^"]+`)
                    );
                    const rank = text.match(
                      new RegExp(
                        `(?<=data-asin=\\\\"${info.asin}\\\\") data-index=\\\\"(\\d+)\\\\"`
                      )
                    );
                    iframe[`text${i}`] = text;
                    if (match) {
                      link = {
                        url: new DOMParser()
                          .parseFromString(match[0], 'text/html')
                          .body.textContent.replace(/.*url=/, ''),
                        rank: rank ? `${i + 1}-${rank[1]}` : '',
                        text,
                        i,
                      };
                    }
                    return text;
                  })
                  .catch(() => {});
              };

              await matchLink(
                JSON.stringify({
                  'page-content-type': 'atf',
                  'prefetch-type': 'rq',
                  'customer-action': 'pagination',
                })
              ).then(async text => {
                iframe[`prefetchText${i}`] = text;
                if (!text) return;
                let ajaxData = text.match(
                  /(?<=data-prefetch-ajax-data-passing)[\s\S]+?payload"[^"]+"([^"]+)/
                );
                if (!ajaxData || !ajaxData[1]) return;

                await matchLink(
                  JSON.stringify({
                    'customer-action': 'pagination',
                    'prefetch-type': 'log',
                    'page-content-type': 'btf',
                    'prefetch-ajax-data': ajaxData[1],
                    wIndexMainSlot: 7,
                  })
                ).then(text => {
                  iframe[`fetchAjaxDataText${i}`] = text;
                });
              });

              await matchLink();
            }
          }
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (e) {}
      iframe && document.body.removeChild(iframe);

      return link;
    },
    { ...info, keyword, asin }
  );

  if (result && result.url) {
    result.url = result.url
      .replace(/crid=\w+&?/, '')
      .replace(/qid=\d+&?/, '')
      .replace(/sprefix=[^&]+&?/, '')
      .replace(/keywords=[^&]+&?/, '')
      .replace(/\\$/, '');

    if (!result.rank && result.text) {
      fs.writeFileSync(`./${info.asin}.txt`, result.text);
    }
    delete result.text;
  }
  return result;
}

const pushGetRankQueue = getQueueHandler(getRank);

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
    const result = await pushGetRankQueue({
      targetPage,
      asin: asinList[1].asin,
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 200,
        result,
      })
    );
  });
}

async function goUpdateRank(targetPage, timeId) {
  for (const item of asinList) {
    if (timeId !== timeout) return;
    const result = await pushGetRankQueue({ targetPage, asin: item.asin });
    if (result) {
      console.log(item, result.url, result.rank, result.i);
    } else {
      console.log(item, result);
    }
    if (result && result.url) {
      const url = /^https:\/\//.test(result.url)
        ? result.url
        : `https://www.amazon.com/${result.url}`;
      const rank = result.rank ? `&rank=${result.rank}` : '';
      const options = {
        hostname: '127.0.0.1',
        port: 8001,
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
  clearTimeout(timeout);
  let currentTimeout;
  console.log('updateRankTask', new Date().toLocaleString());
  timeout = setTimeout(
    async () => {
      await goUpdateRank(targetPage, currentTimeout);
      if (currentTimeout !== timeout) return;
      updateRankTask(targetPage);
    },
    immediate ? 60 * 1000 : 60 * 60 * 1000
  );
  currentTimeout = timeout;
}

exports.updateRankTask = updateRankTask;
exports.updateAsinList = updateAsinList;
exports.getRank = getRank;
exports.loadAsin = loadAsin;
