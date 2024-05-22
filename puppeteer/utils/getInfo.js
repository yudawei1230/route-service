const fs = require('fs')
const path = require('path')
const { taskMap, getQueueHandler } = require('./queue');
const lastGetHrefPage = {}
const cookiesList = []
let cookieIndex = 0
const loadCookies = getQueueHandler('loadCookies', function() {
  try {
    const f = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cookies.txt')).toString())
    cookiesList.length = 0
    cookiesList.push(...f)
    cookieIndex = 0
    return cookiesList
  } catch(e) {
    cookiesList.length = 0
  }
}) 
loadCookies()
exports.cookiesList = cookiesList

let errorTime = 0
async function reLogin(targetPage) {
  if(errorTime > 6) return 
  const cookies = await targetPage.cookies()
  for(const item of cookies) {
    if(item.name.includes('session')) {
      await targetPage.deleteCookie(item)
    }
  }
  
  try {
    await targetPage.goto('https://www.amazon.com/');
    await targetPage.evaluate(() => {
      location.reload(true)
    })
    await new Promise(resolve => setTimeout(resolve, 3000))
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
      errorTime++
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
    setTimeout(() => clearInterval(timeout), 13000)
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
      errorTime++
      return reLogin(targetPage);
    } else {
      errorTime = 0
    }
  } catch(e) {
    // loginFailedTime++
    // console.log('failed', e.message)
    await new Promise(resolve => {
      errorTime++
      setTimeout(() => resolve(reLogin(targetPage)), 1000)
    });
  }

}

async function queryHref(targetPage, { asin, keyword , sprefix, crid, brand, isFirst, cacheKey }) {
  const isRightLoc = await targetPage.evaluate(() => {
    const dom = document.getElementById('glow-ingress-block');
    return dom && dom.innerText.includes('New York 10111‌');
  });
  let brandStr = (!brand || hrefCache[cacheKey]) ? '' : ` ${brand || ''}`
  
  if(!isRightLoc) return 
  async function searchHref(page, totalPage, lastTry) {
    if(!!taskMap.cridReq?.size && !isFirst) {
      return 'stop'
    }
    const noTotalPage = totalPage === 0
    totalPage = totalPage || page
    const src = `https://www.amazon.com/s?k=${keyword}${brandStr}&page=${page}&crid=${crid}qid=${(
      Date.now() / 1000
    ).toFixed(0)}&sprefix=${sprefix}&ref=sr_pg_${page}`;
    await targetPage.evaluate((src) => {location.href = src}, src).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 1000))
    // await targetPage.goto(src);
    const info = await targetPage.evaluate(({ page, asin }) => {
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
      if (dom && dom.length) {
        let hrefDom = [...dom].find(v => v.href.includes(`/${asin}/`) || v.href.includes('/sspa/click?'));
        let href 
        if(hrefDom) {
          const url = hrefDom.href
          if(url && url.includes('/sspa/click?')) {
            href = (new URLSearchParams(url)).get('url')
          } else {
            href = url
          }
          href = href || url
        }
        return {
          href,
          page,
          allPage,
        };
      }
      return { allPage }
    }, { page, asin });
    if(info.allPage) {
      totalPage = info.allPage;
    }
    
    if (info && info.href) {
      if(!brandStr) lastGetHrefPage[cacheKey] = page
      return info.href;
    }
    else if (lastTry) {
      return 
    }
    else if (!noTotalPage && totalPage && totalPage > page) {
      return searchHref(page + 1, totalPage);
    }
    else if(brand && !lastTry){
      if(brandStr !== ` ${brand || ''}`) {
        brandStr = ` ${brand || ''}`
        const href = await searchHref(1, 0, true)
        if(href) return href
      }
      keyword = asin
      return searchHref(1, 0, true)
    }
  }
  if (lastGetHrefPage[cacheKey]) {
    const href = await searchHref(lastGetHrefPage[cacheKey]);
    if(href) return href
  }
  return searchHref(1);
}

const syncSearchHref = getQueueHandler('getInfo', queryHref, { appendHead: true });
const asyncSearchHref = getQueueHandler('getInfo', queryHref);
const syncReLogin = getQueueHandler('getInfo', reLogin);

exports.syncReLogin = syncReLogin;
exports.loadCookies = loadCookies;

const caches ={}
const hrefCache = {}
async function getInfo(targetPage, keyword, asin, brand) {
  if (!asin) return {
    crid: '',
    sprefix: '',
    refTag: '',
    href: '',
  };
  if (!targetPage)
    // 获取当前页面的URL
    return;
  let resolve;
  const currentUrl = await targetPage.url();
  const cacheKey = `${asin}_${decodeURIComponent(keyword)}`;
  const crid = new Promise(r => (resolve = r));
  setTimeout(() => {
    if(caches[cacheKey] && caches[cacheKey].crid) {
      resolve(caches[cacheKey].crid)
    }
  }, 3000)
  if (!currentUrl.includes('https://www.amazon.com')) return;
  await targetPage.waitForSelector('input[name=field-keywords]');
  
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
            asin,
            keyword,
            cid: data.responseId,
            crid: 'crid=' + data.responseId,
            sprefix: (await sprefix) || '',
            refTag: target ? target.refTag : '',
            brand
          };

          if (entity.crid) {
            caches[cacheKey] = entity;
            resolve(entity);
          } else {
            resolve(caches[cacheKey] || entity);
          }
        } else {
          resolve(
            caches[cacheKey] || {
              crid: '',
              sprefix: '',
              refTag: '',
            }
          );
        }
      } catch (e) {
        console.log(e);
      }
    }
  };
  
  targetPage.click('input[name="field-keywords"]');
  targetPage.on('response', responseHandler);
  await new Promise(resolve => setTimeout(resolve, 400))
  await targetPage.keyboard.down('Control'); // 按下 Control 键
  await targetPage.keyboard.press('A'); // 按下 A 键，选中所有文本
  await new Promise(resolve => setTimeout(resolve, 400))
  await targetPage.keyboard.up('Control'); // 释放 Control 键
  await new Promise(resolve => setTimeout(resolve, 400))
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
  }, 5000);

  return crid.finally(() => {
      targetPage.removeListener('response', responseHandler);
  });
}

const getCrid = getQueueHandler('getInfo', getInfo, { appendHead: true });
async function loopUpdateHref(targetPage, cacheKey) {
  const asin = caches[cacheKey].asin;

  const href = await asyncSearchHref(targetPage, {
    keyword: caches[cacheKey].keyword,
    crid: caches[cacheKey].crid,
    sprefix: caches[cacheKey].sprefix,
    asin,
    brand: caches[cacheKey].brand,
    cacheKey
  });
  if(href === 'stop') {
    while(!!taskMap.cridReq?.size) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    await loopUpdateHref(targetPage, cacheKey)
    return 
  }
  if (href) {
    hrefCache[cacheKey] = href;
  }
}

async function loopUpdateAsinHrefList(targetPage) {
  try {
    errorTime = 0
    await syncReLogin(targetPage)
    const isRightLoc = await targetPage.evaluate(() => {
      const dom = document.getElementById('glow-ingress-block');
      return dom && dom.innerText.includes('New York 10111‌');
    });
    if (isRightLoc) {
      for (const cacheKey in caches) {
        while(!!taskMap.cridReq?.size) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        await loopUpdateHref(targetPage, cacheKey);
      }
    }
  } catch(e) {
    console.log(e)
  }
    
  setTimeout(() => loopUpdateAsinHrefList(targetPage), 60000);
}
exports.loopUpdateAsinHrefList = loopUpdateAsinHrefList;
exports.getAsyncCrid = getQueueHandler('cridReq', async function (targetPage, keyword, asin, brand) {
  const cacheKey = `${asin}_${decodeURIComponent(keyword)}`;

  const data = await getCrid(targetPage, keyword, asin, brand)
  if(!data) return
  if (data.cid) {
    data.href = hrefCache[cacheKey];
  }
  if (data.cid && (!data.href)) {
    data.href =
      hrefCache[cacheKey] ||
      syncSearchHref(targetPage, {
        keyword,
        crid: data.cid,
        sprefix: data.sprefix,
        asin,
        brand,
        isFirst: true
      });
    data.href = await data.href;
    if(data.href) hrefCache[cacheKey] = data.href;
  }
  return data;
});
