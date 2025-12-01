# ================================
# Etapa 1: Build y Dependencias
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copiar archivos de dependencias
COPY package*.json ./

# 2. Instalar dependencias
RUN npm ci --legacy-peer-deps

# 3. Copiar el código fuente
COPY . .

# 4. Build de Angular para producción
RUN npm run build -- --configuration production

# ================================
# Etapa 2: Runtime (Producción)
# ================================
FROM node:20-alpine

WORKDIR /app

# Instalar serve globalmente
RUN npm install -g serve

# Copiar los archivos construidos
COPY --from=builder /app/dist/frontend ./dist/frontend

# Exponer puerto (opcional, solo documentación)
EXPOSE 4200

# Servir la SPA usando el puerto que Render asigne (o 4200 localmente)
CMD ["sh", "-c", "serve -s dist/frontend -l ${PORT:-4200} -n"]
