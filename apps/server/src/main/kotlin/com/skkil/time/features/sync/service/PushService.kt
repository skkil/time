package com.skkil.time.features.sync.service

import com.skkil.time.common.web.Caller
import com.skkil.time.features.changes.service.ChangeService
import org.skkil.store.push.ConnectPushCodec
import org.skkil.store.push.ConnectReply
import org.skkil.store.push.PushHandler
import org.skkil.store.v1.MutationResult
import org.springframework.stereotype.Service

/**
 * `skkil.store.v1.PushService/Push` for the caller's scope. Each mutation commits on its own through store's write
 * path; when any applied, the account's change counter moves and the realtime bus tells REST clients to refetch.
 */
@Service
class PushService(
    private val handler: PushHandler,
    private val codec: ConnectPushCodec,
    private val changes: ChangeService,
) {
    fun push(caller: Caller, body: ByteArray, contentType: String?, contentEncoding: String?): ConnectReply {
        var writer: String? = null
        val reply =
            codec.handle(body, contentType, contentEncoding) { request ->
                handler.push(caller.scopeId, request).also { response ->
                    if (response.resultsList.any { it.status == MutationResult.Status.STATUS_APPLIED }) {
                        writer = request.clientId.take(MAX_WRITER)
                    }
                }
            }
        writer?.let { changes.record(caller.id, it, TOPIC) }
        return reply
    }

    private companion object {
        const val TOPIC = "sync"
        const val MAX_WRITER = 100
    }
}
