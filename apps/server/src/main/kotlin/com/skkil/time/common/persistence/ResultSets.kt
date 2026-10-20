package com.skkil.time.common.persistence

import java.sql.ResultSet
import java.time.LocalDate
import java.util.UUID

fun ResultSet.longOrNull(column: String): Long? = getObject(column, java.lang.Long::class.java)?.toLong()

fun ResultSet.intOrNull(column: String): Int? = getObject(column, java.lang.Integer::class.java)?.toInt()

fun ResultSet.doubleOrNull(column: String): Double? = getObject(column, java.lang.Double::class.java)?.toDouble()

fun ResultSet.date(column: String): LocalDate = getObject(column, LocalDate::class.java)

fun ResultSet.dateOrNull(column: String): LocalDate? = getObject(column, LocalDate::class.java)

fun ResultSet.uuid(column: String): UUID = getObject(column, UUID::class.java)

fun ResultSet.uuidOrNull(column: String): UUID? = getObject(column, UUID::class.java)

fun ResultSet.uuids(column: String): List<UUID> =
    (getArray(column)?.array as? Array<*>)?.mapNotNull { it as? UUID } ?: emptyList()
