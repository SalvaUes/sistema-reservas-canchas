# ================================
# Etapa 1: Build y Dependencias
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --legacy-peer-deps

# Copiar código fuente
COPY . .

# Build de Angular para producción
RUN npm run build -- --configuration production

# ================================
# Etapa 2: Runtime (Producción / Desarrollo)
# ================================
FROM node:20-alpine

WORKDIR /app

# Instalar serve globalmente para producción
RUN npm install -g serve

# Copiar los archivos construidos
COPY --from=builder /app/dist/frontend ./dist/frontend

# Exponer puerto (opcional para documentación)
EXPOSE 4200

# CMD que usa PORT si existe (Render), si no usa 4200 para local
CMD ["sh", "-c", "serve -s dist/frontend -l ${PORT:-4200}"]
