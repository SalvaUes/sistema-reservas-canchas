## 💻 Preparar entorno para el correcto funcionamiento del sistema
#### ⚙️ Instalación de Java JDK
- Descargamos el JDK e instalamos desde el siguiente enlace:
- https://www.oracle.com/ae/java/technologies/downloads/
---

#### ⚙️ Instalación de Maven
- Descargamos Maven desde:
- https://maven.apache.org/download.cgi
- Luego descomprimimos el .zip en la ruta C:\.
![](imgs/maven.png)
---

#### ⚙️ Instalación de Node.js
- Descargamos e instalamos Node.js desde su sitio oficial:
- https://nodejs.org/en/download
---

#### ⚙️ Instalación de Angular
- Luego de instalar Node.js, abrimos PowerShell y ejecutamos:
- npm install @angular/cli
---

## 💻 Preparamos PATH con las direcciones de Java, Maven y Node.js
#### ⚙️ Para que el sistema reconozca Java, Maven y Node.js, debemos agregar sus rutas a las variables de entorno:
- En Variables del sistema, damos clic en **New**.
- En **Variable name**, colocamos un nombre identificativo (por ejemplo, JAVA_HOME, MAVEN_HOME, NODEJS_HOME).
- En **Variable value**, colocamos la ruta donde está instalado cada programa.
- Repetimos el proceso para los tres programas.
![](imgs/path.png)
---

## 💻 Pasos para levantar el proyecto
#### ⚙️ Esto se debe realizar en consola o terminal de nuestro editor de código
**Descripción:** Ir a la ruta \sistema-reservas-canchas-main\backend
```bash
# Dockerizar el proyecto (Esto levanta los contenedores del backend y Postgres):
docker-compose up --build
```
![](imgs/commDocker.png)
---

**Descripción:** Ir a la ruta \sistema-reservas-canchas-main\backend
```bash
# Levantar el backend:
mvn clean spring-boot:run
```
![](imgs/commBackend.png)
---

**Descripción:** Ir a la ruta \sistema-reservas-canchas-main\sistema-reservas\frontend
```bash
# Levantar el frontend Angular:
npm install @angular/cli
ng serve
```
![](imgs/commAngular.png)
---
