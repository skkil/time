package com.skkil.time.features.sync.job

import com.skkil.time.config.AppProperties
import com.skkil.time.features.sync.service.BaselineService
import org.slf4j.LoggerFactory
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * Baselines every account created before `sync_baseline` existed, once. It starts when the server is ready, on a
 * virtual thread so readiness never waits for it, and tries again every [RETRY] while accounts remain (held by
 * another instance or failed). Each account is its own transaction under an advisory lock, so instances share the
 * work and an account is never baselined twice.
 */
@Component
class BaselineJob(private val baselines: BaselineService, private val properties: AppProperties) {
    @EventListener(ApplicationReadyEvent::class)
    fun start() {
        if (properties.sync.baselineOnStart) Thread.ofVirtual().name("store-baseline").start(::untilDone)
    }

    /** Baselines the accounts still waiting and returns how many this run did. */
    fun run(): Int =
        baselines.pending().count { (user, scope) ->
            runCatching { baselines.baseline(user, scope) }
                .onFailure { log.error("Baseline of account {} failed", user, it) }
                .getOrDefault(false)
        }

    private fun untilDone() {
        while (true) {
            val done = runCatching { run() }.onFailure { log.error("Baseline run failed", it) }.getOrDefault(0)
            if (done > 0) log.info("Baselined {} accounts", done)
            val left = runCatching { baselines.pending().size }.getOrDefault(1)
            if (left == 0) return
            Thread.sleep(RETRY)
        }
    }

    private companion object {
        val RETRY: Duration = Duration.ofMinutes(1)
        val log = LoggerFactory.getLogger(BaselineJob::class.java)
    }
}
