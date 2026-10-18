package com.skkil.time.features.sections.domain

import java.util.UUID

data class Section(val id: UUID, val projectId: UUID?, val name: String, val position: Int, val collapsed: Boolean)
