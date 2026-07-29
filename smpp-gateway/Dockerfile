# ─── Stage 1: Build the fat JAR with Maven ─────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build
COPY pom.xml .
# Download dependencies first (Docker layer caching)
RUN mvn dependency:go-offline --batch-mode -q
COPY src/ src/
RUN mvn package --batch-mode -DskipTests -q

# ─── Stage 2: Minimal JRE 21 runtime ──────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

# Non-root user
RUN addgroup -g 1000 smpp && adduser -u 1000 -G smpp -D smpp
USER smpp

WORKDIR /app
COPY --from=builder /build/target/smpp-gateway.jar .

# SMPP ESME listener (clients connect here)
EXPOSE 2775
# REST control plane (Node.js gateway-bridge talks here)
EXPOSE 8081

# JVM flags: virtual threads + container awareness
ENV JAVA_OPTS="--enable-preview -XX:+UseZGC -XX:MaxRAMPercentage=75"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar smpp-gateway.jar"]
