package com.skkil.time.features.sections.domain

data class Section(val id: Long, val projectId: Long?, val name: String, val position: Int, val collapsed: Boolean)
