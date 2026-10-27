package com.skkil.time.features.sync.service

import org.skkil.store.writepath.StoreWritePath
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/**
 * Writes the server makes on its own (REST endpoints, jobs, account setup) as store server writes, so every device
 * pulls them: `store_begin_server(scope)`, the write, then `store_end_if_changed()`, all in one transaction. A write
 * that changed no synced row closes without a version, and one made while a mutation is already open (a pushed
 * mutation, an outer server write) joins it.
 */
@Service
class ServerWrites(private val writePath: StoreWritePath, transactions: PlatformTransactionManager) {
    private val transaction = TransactionTemplate(transactions)

    fun <T> run(scope: UUID, block: () -> T): T = transaction.execute { logged(scope, block) }

    private fun <T> logged(scope: UUID, block: () -> T): T {
        if (writePath.isOpen()) return block()
        writePath.beginServer(scope)
        val result = block()
        writePath.endIfChanged()
        return result
    }
}
