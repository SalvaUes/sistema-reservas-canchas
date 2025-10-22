# ================================
# Etapa 1: Build con Maven
# ================================
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app
COPY pom.xml .
COPY src ./src

# Compila sin ejecutar tests para ahorrar tiempo
RUN mvn clean package -DskipTests

# ================================
# Etapa 2: Runtime (JRE Alpine)
# ================================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copiamos solo el JAR generado
COPY --from=builder /app/target/*.jar app.jar

# Exponemos el puerto 8080 (sin cambios)
EXPOSE 8080

# Ejecutar la app
ENTRYPOINT ["java", "-jar", "app.jar"]
