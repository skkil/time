package com.skkil.time.features.rituals.domain

import java.time.LocalDate

/**
 * A ritual that should open, and the Monday of the week it goes on to close, if any: the evening on the review day,
 * or the next morning's offer. A `weekly` ritual with a week is that weekly part on its own, after a snooze.
 */
data class DueRitual(val ritual: Ritual, val week: LocalDate?)
