FROM node:20-alpine
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install -g @angular/cli
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto por defecto de Angular
EXPOSE 4200

# Ejecutar Angular en modo dev
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200"]
