package com.skkil.time.security

data class Identity(val issuer: String, val subject: String, val email: String?, val name: String?)
