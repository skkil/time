import { useRunActions, useWeekToClose } from '@/features/rituals/api';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { isoWeekNumber } from '@/lib/time';

const link =
  'underline decoration-foreground/30 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground';

export function CloseLastWeek() {
  const runner = useRitualRunner();
  const actions = useRunActions();
  const { data: week } = useWeekToClose('morning');
  if (!week) return null;

  const decline = async () => {
    const run = await actions.start.mutateAsync({
      kind: 'weekly',
      taskId: null,
    });
    actions.skip.mutate(run.id);
  };

  return (
    <p className="text-sm text-foreground/85">
      Close week {isoWeekNumber(week)}? About 5 min ·{' '}
      <button
        type="button"
        onClick={() => runner.closeWeek('morning')}
        className={link}
      >
        Close it
      </button>{' '}
      ·{' '}
      <button
        type="button"
        disabled={actions.start.isPending}
        onClick={() => void decline()}
        className={link}
      >
        Not now
      </button>
    </p>
  );
}
