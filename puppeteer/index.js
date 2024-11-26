const http = require('http');
const { fork } = require('child_process');

const browsers = {}
const eventMap = {}
const list = []



let randomIndex = 1
function createBrowser(port) {
  if(browsers[port]) {
    browsers[port].disconnect()
    browsers[port].kill('SIGTERM')
    const i = list.findIndex(v => v === browsers[port])
    if(i > -1) {
      list.splice(i, 1)
    }
  }
  let b = fork('./child.js', [], { env: {
    ...process.env,
    browser_port: port
  }});
  b.BROWSER_PORT = port
  b.BROWSER_TIME = new Date().toLocaleString()
  b.on('exit', () => {

  })
  eventMap[port] = 0
  browsers[port] = b
  startBrowser(port)
  return b
}

const ports = [8811, 8822]

ports.forEach(p => createBrowser(p))

async function send(child, data) {
  const id = Math.random().toString(36).slice(2) + randomIndex++
  eventMap[child.BROWSER_PORT]++
  return new Promise((resolve, reject) => {
    setTimeout(() => reject, 60000)
    child.send(JSON.stringify({ ...data, id }))
    function handler(res) {
      if(!res.includes(id)) return 
      try {
        const data = JSON.parse(res)
        if(data.type === 'error') return reject()
      } catch(e) {}
      child.removeListener('message', handler)
      resolve(res)
    }

    child.on('message', handler)
  }).finally(() => {
    eventMap[child.BROWSER_PORT]--
  })
}


async function startBrowser(port) {
  const browser = browsers[port]
  await send(browser, { type: 'start' }).catch(e => {
    createBrowser(browser.BROWSER_PORT)
  })
  if(!list.includes(browser)) {
    list.push(browser)
  }
  const timeout = setInterval(() => {
    if(!list.includes(browser) && eventMap[browser.BROWSER_PORT] === 0) {
      clearInterval(timeout)
      createBrowser(browser.BROWSER_PORT)
    }
  }, 5000)
}

(async function() {
  function startServer() {
    const server = http.createServer(async (req, res) => {
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      const path = req.url.split('?')[0];
      const method = req.method;
      const keyword = urlParams.get('keyword');
      const asin = urlParams.get('asin');
      const brand = urlParams.get('brand');
      
      if (path === '/getCrid' && method === 'GET' && list[0]) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        const browser = list[0]
        const port = browser.BROWSER_PORT
        const time = browser.BROWSER_TIME
        const dataStr = await send(list[0], { keyword, asin, brand })
        try {
          const data = JSON.parse(dataStr)
          res.end(JSON.stringify({ ...data.res, id: data.id, port, time }))
        } catch(e) {
          res.end(dataStr)
        }
        
        return 
      }
  
      res.statusCode = 404;
      res.end();
    });
  
    server.listen(8833, () => {
      console.log('Server is running on port 8833');
      // updateRankTask(targetPage, true);
    });
  };

  startServer()

  setTimeout(() => {
    setInterval(() => {
      if(!list.length) {
        process.exit(0)
      }
    }, 5000)
  }, 60000)



  setInterval(() => {
    if(list.length > 1 && list[1] && list[1].BROWSER_PORT) {
      const port = list[1].BROWSER_PORT
      send(list[1], { keyword: 'cars', asin: '111', brand: 'lego' })
      .then(() => {
        list.shift()
      })
      .catch(() => {
        createBrowser(port)
      })
    } else if(list.length === 1) {
      const reCreatePort =  ports.find(p => p !== list[0].BROWSER_PORT)
      createBrowser(reCreatePort)
    }
  }, 60000)
})()
