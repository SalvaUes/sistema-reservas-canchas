# ================================
# Etapa 1: Build de Angular
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias primero para aprovechar el cache
COPY package*.json ./
RUN npm ci
RUN npm install -g @angular/cli

# Copiar el resto del código fuente
COPY . .

# ================================
# Etapa 2: Runtime con Node (ng serve)
# ================================
FROM node:20-alpine

WORKDIR /app

# Copiar desde el builder solo lo necesario
COPY --from=builder /app /app

# Instalar Angular CLI globalmente para poder ejecutar ng serve
RUN npm install -g @angular/cli

EXPOSE 4200

# Comando de inicio
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200"]
