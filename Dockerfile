FROM node:20-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY serve.js ./
EXPOSE 3000
CMD ["node", "serve.js"]
