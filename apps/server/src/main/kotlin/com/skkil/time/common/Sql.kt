package com.skkil.time.common

import java.sql.ResultSet
import java.time.LocalDate

fun ResultSet.longOrNull(column: String): Long? = getObject(column, java.lang.Long::class.java)?.toLong()

fun ResultSet.intOrNull(column: String): Int? = getObject(column, java.lang.Integer::class.java)?.toInt()

fun ResultSet.doubleOrNull(column: String): Double? = getObject(column, java.lang.Double::class.java)?.toDouble()

fun ResultSet.date(column: String): LocalDate = getObject(column, LocalDate::class.java)

fun ResultSet.dateOrNull(column: String): LocalDate? = getObject(column, LocalDate::class.java)

fun ResultSet.longs(column: String): List<Long> =
    (getArray(column)?.array as? Array<*>)?.mapNotNull { (it as? Number)?.toLong() } ?: emptyList()
