# ================================
# Etapa 1: Build de Angular
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json para instalar dependencias
COPY package*.json ./

# Instalar dependencias del proyecto
RUN npm ci

# Instalar explícitamente las librerías 
RUN npm install @stomp/stompjs jwt-decode

# Instalar Angular CLI globalmente
RUN npm install -g @angular/cli

# Copiar el resto del código fuente
COPY . .

# ================================
# Etapa 2: Runtime con Node (ng serve)
# ================================
FROM node:20-alpine

WORKDIR /app

# Copiar todo desde la etapa de build
COPY --from=builder /app /app

# Instalar Angular CLI globalmente para ng serve
RUN npm install -g @angular/cli

EXPOSE 4200

# Comando de inicio
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200"]
