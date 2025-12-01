# ============================
# Etapa 1: Build del frontend
# ============================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build --configuration production

# ============================
# Etapa 2: Servir con Nginx
# ============================
FROM nginx:alpine

COPY --from=builder /app/dist/frontend /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
