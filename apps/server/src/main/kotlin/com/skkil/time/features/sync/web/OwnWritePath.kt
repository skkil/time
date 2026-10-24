package com.skkil.time.features.sync.web

/**
 * Keeps a write endpoint out of [ServerWriteAspect]: it opens the store write path itself (Push, account deletion)
 * or writes only tables that do not sync.
 */
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class OwnWritePath
