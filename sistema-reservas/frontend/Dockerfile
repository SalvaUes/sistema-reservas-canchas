# ================================
# Etapa 1: Build y Dependencias
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copiar archivos de definición de dependencias
COPY package*.json ./ 

# 2. Instalar dependencias (usando --legacy-peer-deps)
RUN npm ci --legacy-peer-deps

# 3. Copiar el código fuente
COPY . .

# ================================
# Etapa 2: Runtime (Desarrollo)
# ================================
FROM node:20-alpine

WORKDIR /app

# Copiar TODO (código + node_modules) desde la etapa de build
COPY --from=builder /app /app

# Exponer el puerto de la aplicación (4200 para Angular)
EXPOSE 4200

# Establecer un valor predeterminado para FRONTEND_PORT si no está configurado
ENV FRONTEND_PORT=4200

# Ejecutar ng serve usando FRONTEND_PORT
CMD ["sh", "-c", "./node_modules/.bin/ng serve --host 0.0.0.0 --port $FRONTEND_PORT"]

