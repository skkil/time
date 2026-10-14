package com.skkil.time.features.notifications

import com.skkil.time.common.web.Caller
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/notifications")
class NotificationController(private val devices: DeviceService, private val webPush: WebPushSender) {
    @GetMapping("/config")
    fun config(
        @Suppress("unused") caller: Caller,
    ): PushConfig = PushConfig(webPush.publicKey)

    @GetMapping("/devices")
    fun list(caller: Caller): List<Device> = devices.list(caller.id)

    @PostMapping("/devices")
    fun register(
        caller: Caller,
        @RequestBody input: DeviceInput,
    ): DeviceId = devices.register(caller.id, input)

    @DeleteMapping("/devices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        caller: Caller,
        @PathVariable id: Long,
    ) = devices.delete(caller.id, id)
}
