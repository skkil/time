package com.skkil.time.features.account

import com.skkil.time.auth.Accounts
import com.skkil.time.common.Caller
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

data class Me(val id: Long, val timeZone: String)

@RestController
@RequestMapping("/api/v1/me")
class AccountController(private val accounts: Accounts) {
    @GetMapping
    fun me(caller: Caller) = Me(caller.id, caller.zone.id)

    /** Deletes the account and every row it owns. Required by the app stores. */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(caller: Caller) = accounts.delete(caller.id)
}
