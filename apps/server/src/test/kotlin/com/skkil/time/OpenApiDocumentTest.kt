package com.skkil.time

import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.get
import tools.jackson.databind.SerializationFeature
import java.io.File
import kotlin.test.assertEquals

/**
 * Keeps apps/shared/api/openapi.json in step with the server. `./gradlew openApi` rewrites it;
 * every other test run fails when the committed file is stale.
 */
class OpenApiDocumentTest : ApiTest() {
    @Test
    fun `committed OpenAPI document matches the server`() {
        val body = mvc.get("/v3/api-docs").andReturn().response.contentAsString
        val document =
            mapper
                .rebuild()
                .enable(SerializationFeature.INDENT_OUTPUT)
                .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .build()
                .let { it.writeValueAsString(it.readTree(body)) + "\n" }
        val file = File(System.getProperty("openapi.file"))
        if (System.getProperty("openapi.write") == "true") {
            file.parentFile.mkdirs()
            file.writeText(document)
        } else {
            assertEquals(file.takeIf { it.exists() }?.readText(), document, "Run ./gradlew openApi")
        }
    }
}
