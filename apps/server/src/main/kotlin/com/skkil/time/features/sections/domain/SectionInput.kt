package com.skkil.time.features.sections.domain

import java.util.UUID

data class SectionInput(val projectId: UUID?, val name: String, val before: UUID?)
