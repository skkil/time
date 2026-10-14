package com.skkil.time.common.error

class DomainException(val kind: ErrorKind, message: String) : RuntimeException(message)
