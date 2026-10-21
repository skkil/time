package com.skkil.time.features.time.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.time.domain.BlockSpan
import com.skkil.time.features.time.domain.TimeBlock
import com.skkil.time.features.time.service.BlockService
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.util.UUID

@RestController
@RequestMapping("/api/v1")
class BlockController(private val blocks: BlockService) {
    @GetMapping("/blocks")
    fun listBlocks(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<TimeBlock> = blocks.list(caller, from, to)

    @PostMapping("/tasks/{id}/blocks")
    fun createBlock(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody span: BlockSpan,
    ): TimeBlock = blocks.create(caller, id, span)

    @PutMapping("/blocks/{id}")
    fun rescheduleBlock(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody span: BlockSpan,
    ): TimeBlock = blocks.reschedule(caller.id, id, span)

    @DeleteMapping("/blocks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteBlock(
        caller: Caller,
        @PathVariable id: UUID,
    ) = blocks.delete(caller.id, id)
}
