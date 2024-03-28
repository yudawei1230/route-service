const { getQueueHandler } = require('./queue');
const lastGetHrefPage = {}

let loginSuccessTime = 0
let loginFailedTime = 0
async function reLogin(backupPage, params) {
  const session = (await backupPage.cookies()).find(
    v => v.name === 'session-id' && v.domain === '.amazon.com'
  );
  if (!session) {
    setTimeout(() => reLogin(backupPage, params), 3000);
    return 
  }
  try {
    if (params?.noDeleteCookie !== false) {
      const cookies = await backupPage.cookies()
      for(const item of cookies) {
        if(item.name.includes('session')) {
          await backupPage.deleteCookie(item)
        }
      }
      await backupPage.deleteCookie({
        name: 'ubid-main',
        url: 'https://www.amazon.com',
        domain: '.amazon.com',
        path: '/',
        secure: true,
      });
    }
    await backupPage.goto('https://www.amazon.com/');
    backupPage.waitForSelector('.a-text-right')
    .then(() => {
      backupPage.evaluate(() => {
        const btn = document.querySelector('.a-text-right')
        if (btn.innerText === 'Try different image') {
          backupPage.click('.a-text-right');
        }
      });
    })
    .catch(() => {})

    await backupPage.waitForSelector('#glow-ingress-line2');
    const t1 =setTimeout(() => {
      backupPage.click('#nav-global-location-data-modal-action');
    }, 10000)
    const t2 = setTimeout(() => {
      backupPage.click('#nav-global-location-data-modal-action');
    }, 20000);
    backupPage.click('#nav-global-location-data-modal-action');
    await backupPage.waitForSelector('#GLUXZipUpdateInput');
    clearTimeout(t1)
    clearTimeout(t2)
    backupPage.click('#GLUXZipUpdateInput');
    await new Promise(resolve => setTimeout(resolve, 1000))
    await backupPage.evaluate(() => {
      const input = document.getElementById('GLUXZipUpdateInput');
      if (input) {
        input.value = '10111'
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000))
    await backupPage.click('#GLUXZipUpdate');
    await new Promise(resolve => setTimeout(resolve, 1000))
    await backupPage.reload();
    await backupPage.waitForSelector('#glow-ingress-line2');
    const isRightLoc = await backupPage.evaluate(() => {
      const dom = document.getElementById('glow-ingress-line2')
      return dom && dom.innerText.includes('New York 10111‌');
    });
    if(!isRightLoc) {
      console.log('错误地址重新登录')
      loginFailedTime++
      return reLogin(backupPage, params);
    } else {
      loginSuccessTime++
    }
  } catch(e) {
    loginFailedTime++
    console.log(e.message)
    await new Promise(resolve =>
      setTimeout(() => resolve(reLogin(backupPage, params)), 1000)
    );
  }
}
let updateSuccessTime = 0
let updateFailedTime = 0
async function queryHref(backupPage, { asin, keyword , sprefix, crid }) {
  const cacheKey = `${keyword}_${asin}`
  const isRightLoc = await backupPage.evaluate(() => {
    const dom = document.getElementById('glow-ingress-line2');
    return dom && dom.innerText.includes('New York 10111‌');
  });
  if(!isRightLoc) return 
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
      lastGetHrefPage[cacheKey] = page
      return info.href;
    }
    else if (totalPage && totalPage > page) {
      return searchHref(page + 1, totalPage);
    }
  }
  if (lastGetHrefPage[cacheKey]) {
    const href = await searchHref(lastGetHrefPage[cacheKey]);
    if(href) return href
  }
  return searchHref(1);
}

const syncSearchHref = getQueueHandler('queryHref', queryHref, { appendHead: true });
const asyncSearchHref = getQueueHandler('queryHref', queryHref);
const syncReLogin = getQueueHandler('queryHref', reLogin, { appendHead: true });

exports.syncReLogin = syncReLogin;

const caches ={}
const hrefCache = {}
const timeoutMap = {}
async function getInfo(targetPage, keyword, asin) {
  if (!asin) return {
    crid: '',
    sprefix: '',
    refTag: '',
    href: '',
  };
    if (!targetPage)
      // 获取当前页面的URL
      return;
  await targetPage.intervalReload();
  const currentUrl = await targetPage.url();
  const cacheKey = `${asin}_${decodeURIComponent(keyword)}`;
  if (currentUrl.includes('?')) {
    await targetPage.goBack();
  }
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
  }, 5000);

  return crid.finally(() => {
      targetPage.removeListener('response', responseHandler);
  });
}

const getCrid = getQueueHandler('getInfo', getInfo);
let sameHrefTime = 0
async function loopUpdateHref(backupPage, cacheKey) {
  const asin = caches[cacheKey].asin;
  if (!caches[cacheKey]) return;
  console.log('异步更新dib', cacheKey);

  const href = await asyncSearchHref(backupPage, {
    keyword: caches[cacheKey].keyword,
    crid: caches[cacheKey].crid,
    sprefix: caches[cacheKey].sprefix,
    asin,
  });
  if (href) {
    updateSuccessTime++
    if (hrefCache[cacheKey] && hrefCache[cacheKey] === href) {
      sameHrefTime++
    }
    hrefCache[cacheKey] = href;
  } else {
    updateFailedTime++ 
  }
  href
    ? console.log('异步更新dib成功', cacheKey)
    : console.log('异步更新dib失败', cacheKey);
}

async function loopUpdateAsinHrefList(backupPage) {
  process.stdout.write('\033c');
  console.log(`dib更新成功次数${updateSuccessTime}, 失败次数${updateFailedTime}, 登录成功次数${loginSuccessTime}, 登录失败次数${loginFailedTime}, dib相同次数${sameHrefTime}`)
  try {
    const isRightLoc = await backupPage.evaluate(() => {
      const dom = document.getElementById('glow-ingress-line2');
      return dom && dom.innerText.includes('New York 10111‌');
    });
    await syncReLogin(backupPage);
    if (isRightLoc) {
      console.log('新建轮询更新', '当前轮询数', Object.keys(hrefCache));
      for (const cacheKey in caches) {
        await loopUpdateHref(backupPage, cacheKey);
      }
    }
  } catch(e) {
    console.log(e)
  }
    
  setTimeout(() => loopUpdateAsinHrefList(backupPage), 30000);
}
exports.loopUpdateAsinHrefList = loopUpdateAsinHrefList;
exports.getAsyncCrid = async function (targetPage, backupPage, keyword, asin) {
  const cacheKey = `${asin}_${decodeURIComponent(keyword)}`;
  const data = await getCrid(targetPage, keyword, asin);
  if (data.cid) {
    data.href = hrefCache[cacheKey];
  }
  if (data.cid && (!data.href || !timeoutMap[cacheKey])) {
    data.href =
      hrefCache[cacheKey] ||
      syncSearchHref(backupPage, {
        keyword,
        crid: data.cid,
        sprefix: data.sprefix,
        asin,
      });
    data.href = await data.href;
    hrefCache[cacheKey] = data.href;
  }
  return data;
};
