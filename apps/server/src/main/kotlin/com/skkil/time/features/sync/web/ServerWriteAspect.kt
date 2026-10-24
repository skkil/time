package com.skkil.time.features.sync.web

import com.skkil.time.common.web.Caller
import com.skkil.time.features.sync.service.ServerWrites
import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.annotation.Aspect
import org.springframework.stereotype.Component

/**
 * Runs every REST write endpoint that acts for a [Caller] as one store server write in the caller's scope, so a
 * change made on the web reaches every device through the log. The endpoint's services join its transaction, and a
 * failure rolls back the rows and the log entry together.
 */
@Aspect
@Component
class ServerWriteAspect(private val writes: ServerWrites) {
    @Around(
        "@within(org.springframework.web.bind.annotation.RestController) && (" +
            "@annotation(org.springframework.web.bind.annotation.PostMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PutMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PatchMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.DeleteMapping)) && " +
            "!@annotation(com.skkil.time.features.sync.web.OwnWritePath) && " +
            "!@within(com.skkil.time.features.sync.web.OwnWritePath)",
    )
    fun logged(point: ProceedingJoinPoint): Any? {
        val caller = point.args.filterIsInstance<Caller>().singleOrNull() ?: return point.proceed()
        return writes.run(caller.scopeId) { point.proceed() }
    }
}
