module.exports = async function getInfo(targetPage, keyword) {
  // 获取当前页面的URL
  if (!targetPage) return;
  const currentUrl = await targetPage.url();

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
        if (decodeURIComponent(data.prefix) === decodeURIComponent(keyword)) {
          const target = data.suggestions.find(v => v.value === keyword);
          resolve &&
            resolve({
              crid: 'crid=' + data.responseId,
              sprefix: (await sprefix) || '',
              refTag: target ? target.refTag : '',
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
  setTimeout(() => {
    resolve({
      crid: '',
      sprefix: '',
      refTag: '',
    });
  }, 3000);
  const crid = await new Promise(r => (resolve = r));
  targetPage.removeListener('response', responseHandler);

  return crid;
};
