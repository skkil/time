package com.skkil.time.security

import java.time.ZoneId
import java.util.UUID

data class Account(val id: Long, val scopeId: UUID, val zone: ZoneId)
