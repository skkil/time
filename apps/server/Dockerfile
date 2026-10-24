# syntax=docker/dockerfile:1
# Build with the pinned store checkout as a named context:
#   docker build --build-context store=../store apps/server
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src/store/modules
COPY --from=store modules/protocol protocol
COPY --from=store modules/adapter-jvm/gradle adapter-jvm/gradle
COPY --from=store modules/adapter-jvm/src adapter-jvm/src
COPY --from=store modules/adapter-jvm/settings.gradle.kts modules/adapter-jvm/build.gradle.kts modules/adapter-jvm/gradle.properties adapter-jvm/
WORKDIR /src/server
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon -PstoreDir=/src/store dependencies > /dev/null
COPY src src
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon -PstoreDir=/src/store bootJar -x test \
 && java -Djarmode=tools -jar build/libs/time-server-*.jar extract --layers --launcher --destination /app

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 time
WORKDIR /app
COPY --from=build /app/dependencies/ ./
COPY --from=build /app/spring-boot-loader/ ./
COPY --from=build /app/snapshot-dependencies/ ./
COPY --from=build /app/application/ ./
USER 10001
EXPOSE 8080 8081
ENV SPRING_PROFILES_ACTIVE=prod JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
HEALTHCHECK --interval=30s --timeout=3s CMD ["sh", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080"]
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
