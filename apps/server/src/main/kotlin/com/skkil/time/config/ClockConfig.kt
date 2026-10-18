package com.skkil.time.config

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.clock.SystemMutationClock
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.id.UuidV7Generator
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class ClockConfig {
    @Bean
    fun mutationClock(): MutationClock = SystemMutationClock

    @Bean
    fun idGenerator(): IdGenerator = UuidV7Generator()
}
