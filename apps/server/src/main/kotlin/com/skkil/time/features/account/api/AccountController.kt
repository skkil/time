package com.skkil.time.features.account.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.sync.web.OwnWritePath
import com.skkil.time.security.AccountService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/me")
class AccountController(private val accounts: AccountService) {
    @GetMapping
    fun me(caller: Caller) = Me(caller.id, caller.zone.id, caller.scopeId)

    /** Deletes the account, every row it owns and its sync log. Required by the app stores. */
    @OwnWritePath
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(caller: Caller) = accounts.delete(caller.id, caller.scopeId)
}
