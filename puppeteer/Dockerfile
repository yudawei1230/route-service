#docker stop browser && docker rm -v browser  && docker rmi browser && docker build -t browser . && docker run -d  --rm --name browser -p 8822:8822 -p 8833:8833 browser && docker logs -f browser
#docker stop browser && docker rmi browser && docker build -t browser . &&  && docker logs -f browser
#docker run -d --name browser --network host browser
#docker run -e "ENABLE_DEBUGGER=false" -e "TOKEN=ec1123" -e "PREBOOT_CHROME=true" -e "KEEP_ALIVE=true" -e "CHROME_REFRESH_TIME=-1" -e "MAX_CONCURRENT_SESSIONS=2"  -e "CONNECTION_TIMEOUT=-1" -p 3000:3000 --restart always -d --name browser browserless/chrome  
#docker load -i browser.tar
#docker save -o browser.tar browser
#docker run -d  -v $(pwd):/app  --network host --name browser browser && docker logs -f browser

#docker build -t browser . && docker run -d --init --restart always -m 1.5g --name browser -p 8811:8811 -p 8822:8822 -p 8833:8833 browser && docker logs -f browser

#docker run -d  --rm --name browser -p 8822:8822 -p 8833:8833 browser && docker logs -f browser

FROM buildkite/puppeteer                                                                         
                                                                                                 
WORKDIR /app                                                                                     
                                                                                                 
# 把当当前目录的模样   所有内容都拷贝到 app工作目录                                                                   
COPY . /app                                                                                      
                                                                                                 
                                                                 
CMD ["node", "./index.js"]