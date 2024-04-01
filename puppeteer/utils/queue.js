const taskMap = {}
let page;
function startLoop(targetPage) {
  page = targetPage;
  setInterval(() => {
    page.intervalReload();
  }, 5000);
}

function getQueueHandler(taskType, fn, options) {
  if (!taskMap[taskType]) taskMap[taskType] = new Set()
  
   if (!(fn instanceof Function)) return;
  return (...params) => {
    let resolve;
    let exec;
    const cb = async () => {
      if (exec) return;
      exec = true;
      await page.intervalReload();
      const result = await new Promise(resolve => resolve(fn(...params))).catch(() => null);
      taskMap[taskType].delete(cb);
      resolve(result);
      Promise.resolve().then(() => {
        if (taskMap[taskType].size > 0) {
          const iterator = taskMap[taskType].values();
          const headCb = iterator.next().value;
          headCb();
        }
      });
    };
    if (options?.appendHead) {
      taskMap[taskType] = new Set(
        [cb].concat(Array.from(taskMap[taskType].values()))
      );
    } else {
      taskMap[taskType].add(cb);
    }
    if (taskMap[taskType].size === 1) cb();
    
    return new Promise(r => {
      resolve = r;
    });
  };
}

exports.taskMap = taskMap

exports.startLoop = startLoop;

exports.getQueueHandler = getQueueHandler;
