FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install express cors
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
