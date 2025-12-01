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

# ================================
# Etapa 2: Servir con Nginx
# ================================
FROM nginx:alpine

# Copiar los archivos generados a la carpeta de Nginx
COPY --from=builder /app/dist/frontend /usr/share/nginx/html

# Copiar el archivo nginx.conf desde el mismo directorio que el Dockerfile
COPY nginx.conf /etc/nginx/nginx.conf

# Exponer el puerto adecuado (por defecto, Nginx usa el puerto 80)
EXPOSE 80

# Ejecutar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
