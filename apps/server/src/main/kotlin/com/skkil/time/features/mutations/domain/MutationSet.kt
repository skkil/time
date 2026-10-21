package com.skkil.time.features.mutations.domain

/** The write commands of one feature. */
interface MutationSet {
    val mutations: List<Mutation>
}
