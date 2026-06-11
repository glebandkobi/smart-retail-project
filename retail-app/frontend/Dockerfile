
# STAGE 1: Build
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# STAGE 2: Run
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
# ADD THIS LINE to copy your file manually after the build
COPY factory.html /usr/share/nginx/html/factory.html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]