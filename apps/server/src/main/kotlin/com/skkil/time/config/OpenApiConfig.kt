package com.skkil.time.config

import com.skkil.time.common.web.Caller
import io.swagger.v3.core.converter.ModelConverter
import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.media.ArraySchema
import io.swagger.v3.oas.models.security.SecurityRequirement
import io.swagger.v3.oas.models.security.SecurityScheme
import org.springdoc.core.utils.SpringDocUtils
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.JsonNode

/**
 * The OpenAPI document. A `JsonNode` appears in the API only as an Undo snapshot row, so it is documented as an array
 * of any values rather than introspected as a bean.
 */
@Configuration
class OpenApiConfig {
    init {
        SpringDocUtils
            .getConfig()
            .addRequestWrapperToIgnore(Caller::class.java)
            .replaceWithSchema(
                JsonNode::class.java,
                ArraySchema().description("A snapshot row: its values in column order"),
            )
    }

    @Bean
    fun openApi(): OpenAPI =
        OpenAPI()
            .info(Info().title("skkil time API").version("v1").description("Tasks, projects, time and review."))
            .components(
                Components().addSecuritySchemes(
                    BEARER,
                    SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT"),
                ),
            ).addSecurityItem(SecurityRequirement().addList(BEARER))

    @Bean
    fun kotlinNullability(): ModelConverter = KotlinNullability()

    private companion object {
        const val BEARER = "bearer"
    }
}
