package com.skkil.time.features.tasks.domain

/**
 * Tasks with every sub-task, their blocks, phase notes, dependencies and the entries and ritual runs linked to them,
 * as captured for Undo. The JSON matches `time_core::undo::TaskSnapshot` field for field, so a snapshot taken on any
 * device restores everywhere as the `restoreTasks` mutation.
 */
data class TaskSnapshot(
    val tasks: SnapshotRows,
    val created: List<SnapshotCreated>,
    val copies: List<SnapshotRows>,
    val dependencies: List<SnapshotDependency>,
    val links: List<SnapshotLink>,
)
