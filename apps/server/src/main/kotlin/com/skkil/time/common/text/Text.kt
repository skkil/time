package com.skkil.time.common.text

import com.skkil.time.common.error.ensure

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
