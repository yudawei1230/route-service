const fs = require('fs')
const path = require('path')
const { taskMap, getQueueHandler } = require('./queue');
const lastGetHrefPage = {}
const cookiesList = []
let isLoginSuccess = false
let lastLoginSuccessTime = null
let loginSuccessTime = 0
let loginFailedTime = 0
let cookieIndex = 0
const loadCookies = getQueueHandler('loadCookies', function() {
  console.log('重置cookies')
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


async function reLogin(targetPage, params) {
  if(lastLoginSuccessTime && loginFailedTime) console.log('上次登录成功时间', lastLoginSuccessTime)
  if(cookieIndex >= 50) {
    cookieIndex = 0
    await loadCookies()
  } else cookieIndex++
  for(const item of cookiesList?.[cookieIndex] || []) {
    await targetPage.setCookie({
      ...item,
      path: '/',
    }); 
  }
  await targetPage.goto('https://www.amazon.com/')
  let isReLogin
  let loadTimeout
  const pms =  new Promise(resolve => {
    loadTimeout = setTimeout(() => {
      isReLogin = true
      loginFailedTime++
      console.log('页面加载异常', loginFailedTime)
      resolve(reLogin(targetPage))
    },3000)
  })
  await Promise.race([
    pms,
    targetPage.waitForSelector('#glow-ingress-line2').catch(() => {})
  ])
  clearTimeout(loadTimeout)
  if(isReLogin) return pms

  const isRightLoc = await targetPage.evaluate(() => {
    const dom = document.getElementById('glow-ingress-line2')
    return dom && dom.innerText.includes('New York 10111‌');
  });
  if(!isRightLoc) {
    console.log('错误地址重新登录', loginFailedTime)
    isLoginSuccess = false
    loginFailedTime++
    return reLogin(targetPage, params);
  } else {
    lastLoginSuccessTime = new Date().toLocaleString()
    isLoginSuccess = true
    loginSuccessTime++
    loginFailedTime = 0
  }  
}
let updateSuccessTime = 0
let updateFailedTime = 0
async function queryHref(targetPage, { asin, keyword , sprefix, crid, brand, isFirst, cacheKey }) {
  const isRightLoc = await targetPage.evaluate(() => {
    const dom = document.getElementById('glow-ingress-line2');
    return dom && dom.innerText.includes('New York 10111‌');
  });
  let brandStr = (!brand || hrefCache[cacheKey]) ? '' : ` ${brand || ''}`
  if(!isRightLoc) return 
  async function searchHref(page, totalPage, lastTry) {
    if(!!taskMap.cridReq?.size && !isFirst) {
      return 'stop'
    }
    const noTotalPage = !totalPage
    totalPage = totalPage || page
    const src = `https://www.amazon.com/s?k=${keyword}${brandStr}&page=${page}&crid=${crid}qid=${(
      Date.now() / 1000
    ).toFixed(0)}&sprefix=${sprefix}&ref=sr_pg_${page}`;
    await targetPage.goto(src);
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
      if (dom) {
        var href = [...dom].find(v => v.href.includes(`/${asin}/`));
        return {
          href: href && href.href,
          page,
          allPage,
        };
      }
      return {}
    }, { page, asin });
    if(info.allPage) {
      totalPage = info.allPage;
    }
    
    if (info && info.href) {
      if (brandStr && !isFirst) console.log('兜底dib获取成功', cacheKey)
      if(!brandStr) lastGetHrefPage[cacheKey] = page
      return info.href;
    }
    else if (totalPage && totalPage > page) {
      return searchHref(page + 1, totalPage);
    }
    else if(!noTotalPage && brand && !lastTry){
      brandStr = ` ${brand || ''}`
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
  const currentUrl = await targetPage.url();
  const cacheKey = `${asin}_${decodeURIComponent(keyword)}`;
  if (!currentUrl.includes('https://www.amazon.com')) return;
  await targetPage.waitForSelector('input[name=field-keywords]');
  
  let resolve;
  const crid = new Promise(r => (resolve = r));
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
let sameHrefTime = 0
async function loopUpdateHref(targetPage, cacheKey) {
  const asin = caches[cacheKey].asin;
  console.log('异步更新dib', cacheKey);

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
    updateSuccessTime++
    if (hrefCache[cacheKey] && hrefCache[cacheKey] === href) {
      sameHrefTime++
    }
    hrefCache[cacheKey] = href;
    if(caches[cacheKey]) caches[cacheKey].lastSetHrefTime = new Date().toLocaleString()
  } else {
    if(caches[cacheKey]) {
      caches[cacheKey].updateFailed = caches[cacheKey].updateFailed ? (caches[cacheKey].updateFailed + 1) : 1
    }
    updateFailedTime++ 
  }
  href
    ? console.log('异步更新dib成功', cacheKey)
    : console.log('异步更新dib失败', cacheKey);
}

async function loopUpdateAsinHrefList(targetPage) {
  process.stdout.write('\033c');
  console.log(`dib更新成功次数${updateSuccessTime}, 失败次数${updateFailedTime}, 登录成功次数${loginSuccessTime}, 登录失败次数${loginFailedTime}, dib相同次数${sameHrefTime}`)
  try {
    await syncReLogin(targetPage);
    const isRightLoc = await targetPage.evaluate(() => {
      const dom = document.getElementById('glow-ingress-line2');
      return dom && dom.innerText.includes('New York 10111‌');
    });
    if (isRightLoc) {
      console.log('新建轮询更新', '当前轮询数', Object.keys(caches));
      for (const cacheKey in caches) {
        if(caches[cacheKey].lastSetHrefTime) {
          console.log(cacheKey, caches[cacheKey].lastSetHrefTime)
          continue
        }
        if(caches[cacheKey].updateFailed > 10) {
          delete caches[cacheKey]
          continue
        }
        while(!!taskMap.cridReq?.size) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        await loopUpdateHref(targetPage, cacheKey);
      }
    }
  } catch(e) {
    console.log(e)
  }
    
  setTimeout(() => loopUpdateAsinHrefList(targetPage), 30000);
}
exports.loopUpdateAsinHrefList = loopUpdateAsinHrefList;
exports.getAsyncCrid = getQueueHandler('cridReq', async function (targetPage, keyword, asin, brand) {
  const cacheKey = `${asin}_${decodeURIComponent(keyword)}`;

  const data = await getCrid(targetPage, keyword, asin, brand)
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
    if(!data.href) delete caches[cacheKey]
    if(data.href) hrefCache[cacheKey] = data.href;
  }
  return data;
});
