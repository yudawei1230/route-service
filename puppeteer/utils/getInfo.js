const { getQueueHandler } = require('./queue');

function queryHref(targetPage, asin) {
  return targetPage.evaluate(
    ({ asin }) => {
      window.index = window.index || 0;
      function genRandomId() {
        return Math.random().toString(36).slice(2, 8) + window.index++;
      }
      let resolve;
      const result = new Promise(r => (resolve = r));
      const frame = document.createElement('iframe');
      frame.src = 'https://www.amazon.com/s?k=' + asin;
      frame.setAttribute('id', genRandomId());
      frame.style.display = 'none';

      const getHref = () => {
        let href;
        var dom =
          frame.contentWindow &&
          frame.contentWindow.document &&
          frame.contentWindow.document.body &&
          frame.contentWindow.document.body.querySelectorAll(
            `div[data-asin=${asin}] a[href]`
          );
        if (dom) {
          href = [...dom].find(v => v.href.includes(`/${asin}/`));
          if (href) {
            resolve(href.href);
            clearInterval(timeout);
            document.body.removeChild(frame);
          }
        }
      };
      var timeout = setInterval(getHref, 300);
      frame.onload = () => {
        if (!href) {
          getHref();
        }
        resolve();
        clearTimeout(timeout);
        document.body.removeChild(frame);
      };
      document.body.appendChild(frame);
      return result;
    },
    { asin }
  );
}

async function getInfo(targetPage, keyword, asin) {
  // 获取当前页面的URL
  if (!targetPage) return;
  await targetPage.intervalReload();
  const currentUrl = await targetPage.url();

  if (currentUrl.includes('?')) {
    await targetPage.goBack();
  }
  if (!currentUrl.includes('https://www.amazon.com')) return;

  const href = queryHref(targetPage, asin)
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

        if (decodeURIComponent(data.prefix) === decodeURIComponent(keyword)) {
          const target = data.suggestions.find(
            v => v.value === decodeURIComponent(keyword)
          );
          resolve &&
            resolve({
              crid: 'crid=' + data.responseId,
              sprefix: (await sprefix) || '',
              refTag: target ? target.refTag : '',
              href: await href,
            });
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
  setTimeout(async () => {
    resolve({
      crid: '',
      sprefix: '',
      refTag: '',
      href: await href,
    });
  }, 3000);
  const crid = await new Promise(r => (resolve = r));
  targetPage.removeListener('response', responseHandler);

  return crid;
}

module.exports = getQueueHandler(getInfo);
