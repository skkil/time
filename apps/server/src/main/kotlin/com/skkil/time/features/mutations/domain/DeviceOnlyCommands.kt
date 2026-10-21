package com.skkil.time.features.mutations.domain

/** Contract commands that act on the device itself, so they are never mutations. */
object DeviceOnlyCommands {
    val names: Map<String, String> =
        mapOf(
            "pickImportFiles" to "opens a file picker",
            "exportData" to "writes a backup file on the device",
            "importData" to "restores a backup file picked on the device",
            "setCaptureHotkey" to "turns the device's global shortcut on or off",
        )
}
