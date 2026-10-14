package com.skkil.time.features.imports.domain

data class ImportProject(
    val name: String,
    val color: String,
    val tasks: List<ImportTask>,
    val sections: List<ImportSection>,
)
