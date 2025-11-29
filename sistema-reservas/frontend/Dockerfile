# ================================
# Etapa 1: Build y Dependencias
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copiar archivos de definición de dependencias
COPY package*.json ./

# 2. Instalar dependencias IGNORANDO conflictos de versiones
# Usamos --legacy-peer-deps para solucionar el error ERESOLVE de Angular
RUN npm ci --legacy-peer-deps

# 3. Copiar el código fuente
COPY . .

# ================================
# Etapa 2: Runtime (Desarrollo/Preview)
# ================================
FROM node:20-alpine

WORKDIR /app

# Copiar TODO (código + node_modules) desde la etapa de build
COPY --from=builder /app /app

# NOTA: Usamos el binario local instalado en node_modules
# Esto evita tener que instalar Angular CLI globalmente y ahorra espacio

EXPOSE 4200

# Ejecutamos el binario local directamente
CMD ["./node_modules/.bin/ng", "serve", "--host", "0.0.0.0", "--port", "4200"]