package com.skkil.time.features.data.domain

/** A column of a backed-up table. [references] names the table whose `id` it points at. */
data class Column(val name: String, val type: ColumnType, val references: String? = null)
