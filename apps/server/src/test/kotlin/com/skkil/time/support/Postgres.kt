package com.skkil.time.support

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.context.annotation.Bean
import org.testcontainers.postgresql.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName

@TestConfiguration(proxyBeanMethods = false)
class Postgres {
    @Bean
    @ServiceConnection
    fun postgresContainer(): PostgreSQLContainer = container

    companion object {
        val container: PostgreSQLContainer by lazy {
            PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine")).withReuse(true)
        }
    }
}
