package com.skkil.time.common

fun requiredText(value: String, what: String, max: Int): String {
    val text = value.trim()
    ensure(text.isNotEmpty()) { "$what can't be empty." }
    ensure(text.codePointCount(0, text.length) <= max) { "$what is longer than $max characters." }
    return text
}

fun optionalText(value: String, what: String, max: Int): String {
    val text = value.trim()
    ensure(text.codePointCount(0, text.length) <= max) { "$what is longer than $max characters." }
    return text
}

fun ensureChanged(rows: Int, what: String) {
    if (rows == 0) notFound("$what not found.")
}
