package com.skkil.time.features.glance.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.glance.domain.Glance
import com.skkil.time.features.glance.service.GlanceService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1")
class GlanceController(private val glance: GlanceService) {
    @GetMapping("/glance")
    fun todayGlance(caller: Caller): Glance = glance.today(caller)
}
