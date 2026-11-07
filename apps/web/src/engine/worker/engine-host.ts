import type { EngineApi, EngineEvent } from '~/engine/protocol';
import type { Core } from '~/engine/worker/core';
import type { Handler } from '~/engine/worker/relay';
import type { SyncRunner } from '~/engine/worker/sync-runner';

type Handlers = {
  [M in keyof EngineApi]: (
    ...args: Parameters<EngineApi[M]>
  ) => ReturnType<EngineApi[M]> | Promise<ReturnType<EngineApi[M]>>;
};

export type EngineHostOptions = {
  core: Core;
  runner: SyncRunner;
  emit(event: EngineEvent): void;
};

/** Serves every tab's calls on the database this worker owns, announcing what changed. */
export function createEngineHost({
  core,
  runner,
  emit,
}: EngineHostOptions): Handler {
  const changed = (source: string | null = null) =>
    emit({ kind: 'changed', tables: [], source });
  const replaced = () => {
    changed();
    runner.report();
  };

  const handlersFor = (source: string): Handlers => {
    const wrote = () => {
      changed(source);
      runner.wrote();
    };
    return {
      mutate(name, args) {
        const result: unknown = JSON.parse(
          core.mutate(name, JSON.stringify(args)),
        );
        wrote();
        return result;
      },
      query: (name, args) => JSON.parse(core.query(name, JSON.stringify(args))),
      status: () => core.status(),
      issues: () => core.issues(),
      dismissIssue(id) {
        const dismissed = core.dismissIssue(id);
        runner.report();
        return dismissed;
      },
      retryIssue(id) {
        const result: unknown = JSON.parse(core.retryIssue(id));
        wrote();
        return result;
      },
      bindScope(scope) {
        const signedIn = core.bindScope(scope);
        if (signedIn.kind !== 'synced') replaced();
        return signedIn;
      },
      keepLocal(scope) {
        const rows = core.keepLocal(scope);
        replaced();
        return rows;
      },
      startFresh(scope) {
        core.startFresh(scope);
        replaced();
      },
      async forget() {
        await runner.stop();
        core.forget();
        replaced();
      },
      dump: () => core.dump(),
      restore(backup) {
        const rows = core.restore(backup);
        changed();
        runner.wrote();
        return rows;
      },
      syncHabits() {
        const report = core.syncHabits();
        wrote();
        return report;
      },
      startSync: () => runner.start(),
      stopSync: () => runner.stop(),
      syncNow: () => runner.now(),
      connectivity: (online) => runner.connectivity(online),
      syncState: () => runner.state(),
    };
  };

  return async (method, args, source) => {
    const handler = handlersFor(source)[method] as (
      ...values: unknown[]
    ) => unknown;
    return handler(...args);
  };
}
