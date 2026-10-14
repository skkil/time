package com.skkil.time.features.data.domain

/** A whole account as one versioned document: table name to rows, keyed by column name. */
data class DataExport(
    val format: String,
    val version: Int,
    val exportedAt: Long,
    val tables: Map<String, List<Map<String, Any?>>>,
)
