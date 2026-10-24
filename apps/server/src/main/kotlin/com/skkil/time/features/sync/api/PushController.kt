package com.skkil.time.features.sync.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.sync.service.PushService
import com.skkil.time.features.sync.web.OwnWritePath
import io.swagger.v3.oas.annotations.Hidden
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController

/** store's Push RPC over Connect (binary or JSON), for the scope of the signed-in caller. */
@Hidden
@RestController
class PushController(private val push: PushService) {
    @OwnWritePath
    @PostMapping("/skkil.store.v1.PushService/Push")
    fun push(
        caller: Caller,
        @RequestBody body: ByteArray,
        @RequestHeader(HttpHeaders.CONTENT_TYPE, required = false) contentType: String?,
        @RequestHeader(HttpHeaders.CONTENT_ENCODING, required = false) contentEncoding: String?,
    ): ResponseEntity<ByteArray> {
        val reply = push.push(caller, body, contentType, contentEncoding)
        return ResponseEntity
            .status(reply.status)
            .contentType(MediaType.parseMediaType(reply.contentType))
            .body(reply.body)
    }
}
