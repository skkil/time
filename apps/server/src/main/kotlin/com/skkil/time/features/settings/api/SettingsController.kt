package com.skkil.time.features.settings.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.settings.repository.SettingsRepository
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** Desktop switches kept per user, with the desktop keys. Both stay on until turned off. */
@RestController
@RequestMapping("/api/v1/settings")
class SettingsController(private val settings: SettingsRepository) {
    @GetMapping("/capture-hotkey")
    fun captureHotkey(caller: Caller): Boolean = isOn(caller, CAPTURE_HOTKEY)

    @PutMapping("/capture-hotkey")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setCaptureHotkey(
        caller: Caller,
        @RequestBody body: Enabled,
    ) = turn(caller, CAPTURE_HOTKEY, body.enabled)

    @GetMapping("/reminders")
    fun reminders(caller: Caller): Boolean = isOn(caller, REMINDERS)

    @PutMapping("/reminders")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setReminders(
        caller: Caller,
        @RequestBody body: Enabled,
    ) = turn(caller, REMINDERS, body.enabled)

    private fun isOn(caller: Caller, key: String) = settings.read(caller.id, key) != "off"

    private fun turn(caller: Caller, key: String, enabled: Boolean) =
        settings.write(caller.id, key, if (enabled) "on" else "off")

    private companion object {
        const val CAPTURE_HOTKEY = "capture_hotkey"
        const val REMINDERS = "reminders_enabled"
    }
}
