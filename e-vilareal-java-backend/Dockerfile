FROM maven:3.9.9-eclipse-temurin-21 AS builder
WORKDIR /app

COPY pom.xml .
COPY e-vilareal-assinatura-core/pom.xml e-vilareal-assinatura-core/
COPY e-vilareal-java-backend/pom.xml e-vilareal-java-backend/
RUN mvn -q -DskipTests dependency:go-offline -pl e-vilareal-java-backend -am

COPY e-vilareal-assinatura-core/src e-vilareal-assinatura-core/src
COPY e-vilareal-java-backend/src e-vilareal-java-backend/src
RUN mvn -q -DskipTests package -pl e-vilareal-java-backend -am

FROM mcr.microsoft.com/playwright/java:v1.52.0-noble
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
WORKDIR /app

COPY --from=builder /app/e-vilareal-java-backend/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
