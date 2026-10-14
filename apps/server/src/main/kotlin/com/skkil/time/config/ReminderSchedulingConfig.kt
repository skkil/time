package com.skkil.time.config

import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling

@Configuration
@EnableScheduling
@ConditionalOnBooleanProperty("time.push.reminders", matchIfMissing = true)
class ReminderSchedulingConfig
