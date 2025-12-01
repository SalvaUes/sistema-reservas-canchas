# ================================
# Etapa 1: Build del frontend
# ================================
FROM node:20-alpine as builder

WORKDIR /app

# Copiar los archivos de definición de dependencias
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiar todo el código fuente
COPY . .

# Ejecutar el build de Angular en configuración de producción
RUN npx ng build --configuration production

# Verificar el contenido de la carpeta dist/frontend
RUN ls -alh /app/dist  # Esto ayuda a confirmar que los archivos están en la ruta correcta

# ================================
# Etapa 2: Servir con Nginx
# ================================
FROM nginx:alpine

# Copiar los archivos generados a la carpeta de Nginx
COPY --from=builder /app/dist/frontend /usr/share/nginx/html

EXPOSE 80

# Ejecutar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
