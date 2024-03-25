const reqList = new Set();

let page;
function startLoop(targetPage) {
  page = targetPage;
  setInterval(() => {
    page.intervalReload();
  }, 5000);
}

function getQueueHandler(fn) {
  if (!(fn instanceof Function)) return;
  return (...params) => {
    let resolve;
    let exec;
    const cb = async () => {
      if (exec) return;
      exec = true;
      await page.intervalReload();
      const result = await Promise.resolve(fn(...params)).catch(() => null);
      reqList.delete(cb);
      resolve(result);
      Promise.resolve().then(() => {
        if (reqList.size > 0) {
          const iterator = reqList.values();
          const headCb = iterator.next().value;
          headCb();
        }
      });
    };
    reqList.add(cb);
    if (reqList.size === 1) cb();
    return new Promise(r => {
      resolve = r;
    });
  };
}

exports.startLoop = startLoop;

exports.getQueueHandler = getQueueHandler;
