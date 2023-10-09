#docker pull mysql:latest
#docker run -d --name ec-mysql -e MYSQL_ROOT_PASSWORD=ec1123 -e MYSQL_DATABASE=ec_route -e MYSQL_USER=ecuser -e MYSQL_PASSWORD=ec1123 -v ./ec-route-mysql-database:/var/lib/mysql -p 3306:3306 mysql
#docker run -d --name nginx --network host -p 8080:80 -v ./nginx/html:/usr/share/nginx/html -v ./nginx/config:/etc/nginx/conf.d nginx
FROM node:lts-alpine

WORKDIR /app

# 配置alpine国内镜像加速
RUN sed -i "s@http://dl-cdn.alpinelinux.org/@https://repo.huaweicloud.com/@g" /etc/apk/repositories

# 安装tzdata,默认的alpine基础镜像不包含时区组件，安装后可通过TZ环境变量配置时区
RUN apk add --no-cache tzdata

# 设置时区为中国东八区，这里的配置可以被docker-compose.yml或docker run时指定的时区覆盖
ENV TZ="Asia/Shanghai"

# 如果各公司有自己的私有源，可以替换registry地址,如使用官方源注释下一行
RUN npm config set registry https://registry.npm.taobao.org

# 安装开发期依赖
COPY package.json ./package.json
RUN npm install
# 构建项目
COPY . .
RUN npm run build
# 删除开发期依赖
RUN rm -rf node_modules && rm package-lock.json    
# 安装生产环境依赖   
RUN npm install --production                          

# 如果端口更换，这边可以更新一下
EXPOSE 8001

CMD ["npm", "run", "start"]