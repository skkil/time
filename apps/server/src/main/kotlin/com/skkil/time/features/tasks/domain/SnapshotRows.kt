package com.skkil.time.features.tasks.domain

import tools.jackson.databind.JsonNode

/** Rows of one [table] as column names and, per row, an array of the values in that order (JSON scalars). */
data class SnapshotRows(val table: String, val columns: List<String>, val values: List<JsonNode>)
