package com.skkil.time.features.sync.domain

/**
 * A synced table as a baseline captures it: one user's rows are those whose [column] holds the user's id, or, when
 * the table has no owner column, the id of one of the user's rows in [parent].
 */
data class BaselineTable(val name: String, val column: String = "user_id", val parent: String? = null)
