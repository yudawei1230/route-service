const https = require('https')
const fs = require('fs')

module.exports = function (origin, port) {
  let cookiesList = []
  try {
    const f = fs.readFileSync('./cookies.txt').toString()
    cookiesList = JSON.parse(f)
  } catch(e) {
    console.log(e)
    cookiesList = []
    return 
  }
  
  const postData = JSON.stringify({  
    list: cookiesList
  })
    
  
  
  try {
    // POST 请求的选项
    const options = {
      hostname: origin,
      port: port,
      path: '/setCookies',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
  
    // 发起 POST 请求
    const req = https.request(options, (res) => {
      console.log(`状态码: ${res.statusCode}`);
  
      res.on('data', (chunk) => {
        console.log(`响应主体: ${chunk}`);
      });
  
      res.on('end', () => {
        console.log('响应已完成');
      });
    });
    req.on('error', (e) => {
      console.error(`连接出错: ${e.message}`);
    });
    // 发送 POST 数据
    req.write(postData);
    req.end();
  } catch(e) {
    console.log(e)
  }
}