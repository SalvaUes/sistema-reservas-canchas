# ================================
# Etapa 1: Build y Dependencias
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build -- --configuration production

# ================================
# Etapa 2: Runtime
# ================================
FROM node:20-alpine

WORKDIR /app
RUN npm install -g serve

# Copiar archivos construidos
COPY --from=builder /app/dist/frontend ./dist/frontend

EXPOSE 4200

# Servir SPA apuntando a la carpeta browser
CMD ["sh", "-c", "serve -s dist/frontend/browser -l ${PORT:-4200} -n"]

