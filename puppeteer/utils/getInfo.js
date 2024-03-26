const { getQueueHandler } = require('./queue');
function queryHref(backupPage, { asin, keyword , sprefix, crid }) {
  async function searchHref(page, totalPage) {
    totalPage = totalPage || page
    const src = `https://www.amazon.com/s?k=${keyword}&page=${page}&crid=${crid}qid=${(
      Date.now() / 1000
    ).toFixed(0)}&sprefix=${sprefix}&ref=sr_pg_${page}`;
    await backupPage.goto(src);
    const info = await backupPage.evaluate(({ page, asin }) => {
      const doc = document.body;
      var allPage;
      var dom = doc && doc.querySelectorAll(`div[data-asin=${asin}] a[href]`);
      if (page === 1 && doc) {
        allPage = [
          ...doc.querySelectorAll(
            'span.s-pagination-item.s-pagination-disabled'
          ),
        ]
          .map(v => Number(v.innerText))
          .find(v => v);
      }
      if (dom) {
        var href = [...dom].find(v => v.href.includes(`/${asin}/`));
        return {
          href: href && href.href,
          allPage,
        };
      }
      return {}
    }, { page, asin });
    if(info.allPage) {
      totalPage = info.allPage;
    }
    
    if (info && info.href) return info.href;
    else if (totalPage > page) {
      return searchHref(page + 1, totalPage);
    }
  }

  return searchHref(1)
}

const asyncSearchHref = getQueueHandler(queryHref);

const caches ={}
const hrefCache = {}
async function getInfo(targetPage, backupPage, keyword, asin) {
  // 获取当前页面的URL
  if (!targetPage) return;
  await targetPage.intervalReload();
  const currentUrl = await targetPage.url();
  const cacheKey = `${asin}_${decodeURIComponent(keyword)}`;
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
      const sprefix = targetPage.evaluate(() => {
        const sprefix = document.getElementById('issprefix');
        return sprefix ? sprefix.value : '';
      });
      try {
        const body = await response.text(); // 或使用 response.buffer() 方法
        const data = JSON.parse(body);

        if (Array.isArray(data.suggestions)) {
          const target = data.suggestions.find(
            v => v.value === decodeURIComponent(keyword)
          );
          
          const entity = {
            cid: data.responseId,
            crid: 'crid=' + data.responseId,
            sprefix: (await sprefix) || '',
            refTag: target ? target.refTag : '',
            href: hrefCache[cacheKey],
          };
          if (entity.cid && !entity.href) {
            entity.href = await queryHref(backupPage, {
              keyword,
              crid: entity.cid,
              sprefix: entity.sprefix,
              asin,
            });
            hrefCache[cacheKey] = entity.href;
            // console.log('新建轮询更新', asin);
            // setInterval(async () => {
            //   console.log('异步更新dib');
            //   const href = await asyncSearchHref(backupPage, {
            //     keyword,
            //     crid: caches[cacheKey].crid,
            //     sprefix: caches[cacheKey].sprefix,
            //     asin,
            //   });
            //   console.log('异步更新dib成功', href);
            // }, 30000);
          }
          if (entity.crid && entity.href) {
            caches[cacheKey] = entity;
            resolve && resolve(entity);
          } else {
            resolve(
              caches[cacheKey] || {
                crid: '',
                sprefix: '',
                refTag: '',
                href: '',
              }
            );
          }
        } else {
          resolve(
            caches[cacheKey] || {
              crid: '',
              sprefix: '',
              refTag: '',
              href: '',
            }
          );
        }
      } catch (e) {
        console.log(e);
      }
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
  setTimeout(async () => {
    resolve(
      caches[cacheKey] || {
        crid: '',
        sprefix: '',
        refTag: '',
        href: '',
      }
    );
  }, 30000);
  const crid = await new Promise(r => (resolve = r));
  targetPage.removeListener('response', responseHandler);

  return crid;
}

module.exports = getQueueHandler(getInfo);
