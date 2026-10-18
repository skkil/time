package com.skkil.time.features.projects.domain

import java.util.UUID

data class ProjectInput(val name: String, val parentId: UUID?, val color: String)
