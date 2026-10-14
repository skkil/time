package com.skkil.time.features.data.domain

/**
 * A table in the backup document. [owner] selects the user's rows when the table has no `user_id`
 * (its rows belong to the user through a parent). [identity] tables get fresh ids on restore.
 */
data class Table(val name: String, val identity: Boolean, val columns: List<Column>, val owner: String? = null) {
    val ownedDirectly = owner == null
}
