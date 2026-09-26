package com.skkil.time

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class TimeApplication

fun main(args: Array<String>) {
    runApplication<TimeApplication>(*args)
}
