package com.skkil.time.features.data.domain

import tools.jackson.databind.JsonNode

/**
 * The argument of `importLocal`: every synced row of a device that signed in for the first time, table by table, each
 * row a JSON object keyed by the device's column names (SQLite values: booleans may be `0`/`1`).
 */
data class LocalData(val tables: List<LocalTableRows>)

/** The rows of one synced table in a [LocalData]. */
data class LocalTableRows(val table: String, val rows: List<Map<String, JsonNode?>>)
