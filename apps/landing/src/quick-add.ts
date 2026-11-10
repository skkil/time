import { type Parsed, parseQuickAdd } from '@skkil-time/rules/quick-add/parse';
import {
  formatDayLabel,
  formatEstimate,
  formatMinutesOfDay,
  todayKey,
} from '@skkil-time/rules/time';

const PROJECTS = [
  { id: 'home', name: 'Home', color: 'var(--project-teal)' },
  { id: 'website', name: 'Website', color: 'var(--project-blue)' },
  { id: 'running', name: 'Running', color: 'var(--project-green)' },
  { id: 'reading', name: 'Reading', color: 'var(--project-plum)' },
];

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function highlight(text: string, parsed: Parsed) {
  const tokens = [...parsed.tokens].sort((a, b) => a.start - b.start);
  let html = '';
  let at = 0;
  for (const token of tokens) {
    html += escape(text.slice(at, token.start));
    html += `<mark data-kind="${token.kind}">${escape(text.slice(token.start, token.end))}</mark>`;
    at = token.end;
  }
  return html + escape(text.slice(at)) + ' ';
}

function details(parsed: Parsed, today: string) {
  const parts: string[] = [];
  const project = PROJECTS.find((p) => p.id === parsed.projectId);
  parts.push(
    project
      ? `<span class="qa-project"><i style="background:${project.color}"></i>${project.name}</span>`
      : '<span>Inbox</span>',
  );
  if (parsed.dueDate) {
    const time =
      parsed.dueTime !== undefined
        ? ` ${formatMinutesOfDay(parsed.dueTime)}`
        : '';
    parts.push(`<span>${formatDayLabel(parsed.dueDate, today)}${time}</span>`);
  }
  if (parsed.recurrence)
    parts.push(`<span>${escape(parsed.recurrence)}</span>`);
  if (parsed.deadline)
    parts.push(`<span>due by ${formatDayLabel(parsed.deadline, today)}</span>`);
  if (parsed.estimate)
    parts.push(`<span>about ${formatEstimate(parsed.estimate)}</span>`);
  if (parsed.priority && parsed.priority < 4)
    parts.push(
      `<span class="qa-p${parsed.priority}">priority ${parsed.priority}</span>`,
    );
  if (parsed.unknownProject)
    parts.push(
      `<span>No project called “${escape(parsed.unknownProject)}”</span>`,
    );
  return parts.join('');
}

export function startQuickAdd(root: HTMLElement) {
  const input = root.querySelector<HTMLInputElement>('input')!;
  const mirror = root.querySelector<HTMLElement>('.qa-mirror')!;
  const title = root.querySelector<HTMLElement>('.qa-title')!;
  const meta = root.querySelector<HTMLElement>('.qa-meta')!;

  const update = () => {
    const now = new Date();
    const today = todayKey();
    const parsed = parseQuickAdd(input.value, {
      today,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      projects: PROJECTS,
      sections: [],
      projectId: null,
    });
    mirror.innerHTML = highlight(input.value, parsed);
    mirror.scrollLeft = input.scrollLeft;
    title.textContent = parsed.title.trim() || 'Untitled task';
    meta.innerHTML = details(parsed, today);
  };

  input.addEventListener('input', update);
  input.addEventListener(
    'scroll',
    () => (mirror.scrollLeft = input.scrollLeft),
  );
  for (const example of root.querySelectorAll<HTMLButtonElement>(
    '[data-example]',
  )) {
    example.addEventListener('click', () => {
      input.value = example.dataset.example ?? '';
      input.focus();
      update();
    });
  }
  update();
}
