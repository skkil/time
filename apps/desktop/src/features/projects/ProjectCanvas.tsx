import { openUrl } from '@tauri-apps/plugin-opener';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { formatDistanceToNow } from 'date-fns';
import {
  BoldIcon,
  CodeSquareIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  StrikethroughIcon,
} from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { Id } from '@/bindings';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { fromSeconds } from '@/lib/time';
import { cn } from '@/lib/utils';

import { useProjectCanvas, useSaveProjectCanvas } from './canvas';
import './canvas.css';

const SAVE_DELAY = 800;

export function ProjectCanvas({ projectId }: { projectId: Id }) {
  const { data } = useProjectCanvas(projectId);
  if (!data) return null;
  return (
    <CanvasEditor
      key={projectId}
      projectId={projectId}
      initial={data.content}
      updatedAt={data.updatedAt}
    />
  );
}

function CanvasEditor({
  projectId,
  initial,
  updatedAt,
}: {
  projectId: Id;
  initial: string;
  updatedAt: number | null;
}) {
  const { mutate: save } = useSaveProjectCanvas(projectId);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [dirty, setDirty] = useState(false);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    save(pending.current, { onSuccess: () => setDirty(false) });
    pending.current = null;
  }, [save]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder:
          'Write anything about this project. Type # for a heading, - for a list, [ ] for a checklist.',
      }),
    ],
    content: initial,
    editorProps: {
      attributes: { class: 'project-canvas', 'aria-label': 'Project canvas' },
      handleClick: (_view, _pos, event) => {
        const link = (event.target as HTMLElement).closest('a');
        if (!link || !(event.metaKey || event.ctrlKey)) return false;
        openUrl(link.href);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      pending.current = editor.getHTML();
      setDirty(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY);
    },
    onBlur: flush,
  });

  useEffect(() => () => flush(), [flush]);

  const status = dirty
    ? 'Saving…'
    : updatedAt === null
      ? 'Not saved yet'
      : `Saved ${formatDistanceToNow(fromSeconds(updatedAt), { addSuffix: true })}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} status={status} />
      <div
        className="min-h-0 flex-1 cursor-text overflow-y-auto px-10 pt-6 pb-24"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            editor.chain().focus('end').run();
        }}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

function Toolbar({ editor, status }: { editor: Editor; status: string }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      task: editor.isActive('taskList'),
      quote: editor.isActive('blockquote'),
      code: editor.isActive('codeBlock'),
      link: editor.isActive('link'),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div className="mx-10 flex shrink-0 flex-wrap items-center gap-0.5 border-b border-white/10 py-1.5">
      <Tool
        label="Heading 1"
        on={active.h1}
        run={() => chain().toggleHeading({ level: 1 }).run()}
      >
        <Heading1Icon />
      </Tool>
      <Tool
        label="Heading 2"
        on={active.h2}
        run={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2Icon />
      </Tool>
      <Tool
        label="Heading 3"
        on={active.h3}
        run={() => chain().toggleHeading({ level: 3 }).run()}
      >
        <Heading3Icon />
      </Tool>
      <Divider />
      <Tool
        label="Bold"
        keys="Ctrl+B"
        on={active.bold}
        run={() => chain().toggleBold().run()}
      >
        <BoldIcon />
      </Tool>
      <Tool
        label="Italic"
        keys="Ctrl+I"
        on={active.italic}
        run={() => chain().toggleItalic().run()}
      >
        <ItalicIcon />
      </Tool>
      <Tool
        label="Strikethrough"
        on={active.strike}
        run={() => chain().toggleStrike().run()}
      >
        <StrikethroughIcon />
      </Tool>
      <LinkTool editor={editor} on={active.link} />
      <Divider />
      <Tool
        label="Bulleted list"
        on={active.bullet}
        run={() => chain().toggleBulletList().run()}
      >
        <ListIcon />
      </Tool>
      <Tool
        label="Numbered list"
        on={active.ordered}
        run={() => chain().toggleOrderedList().run()}
      >
        <ListOrderedIcon />
      </Tool>
      <Tool
        label="Checklist"
        on={active.task}
        run={() => chain().toggleTaskList().run()}
      >
        <ListChecksIcon />
      </Tool>
      <Divider />
      <Tool
        label="Quote"
        on={active.quote}
        run={() => chain().toggleBlockquote().run()}
      >
        <QuoteIcon />
      </Tool>
      <Tool
        label="Code block"
        on={active.code}
        run={() => chain().toggleCodeBlock().run()}
      >
        <CodeSquareIcon />
      </Tool>
      <Tool
        label="Divider"
        on={false}
        run={() => chain().setHorizontalRule().run()}
      >
        <MinusIcon />
      </Tool>
      <span className="ml-auto text-xs text-foreground/75">{status}</span>
    </div>
  );
}

const toolClass = (on: boolean) =>
  cn(
    'grid size-8 place-items-center rounded-md text-foreground/65 outline-none transition-colors hover:bg-white/[.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/40 [&_svg]:size-4',
    on && 'bg-white/[.12] text-foreground',
  );

function Tool({
  label,
  keys,
  on,
  run,
  children,
}: {
  label: string;
  keys?: string;
  on: boolean;
  run: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={on}
          onMouseDown={(event) => event.preventDefault()}
          onClick={run}
          className={toolClass(on)}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {keys && <span className="ml-2 opacity-60">{keys}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function LinkTool({ editor, on }: { editor: Editor; on: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');

  const apply = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (url === '') chain.unsetLink().run();
    else
      chain
        .setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` })
        .run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setHref(editor.getAttributes('link').href ?? '');
        setOpen(next);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Link"
              aria-pressed={on}
              onMouseDown={(event) => event.preventDefault()}
              className={toolClass(on)}
            >
              <LinkIcon />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Link
          <span className="ml-2 opacity-60">Ctrl+click opens it</span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <Input
            autoFocus
            value={href}
            placeholder="Paste a link, or leave empty to remove it"
            onChange={(event) => setHref(event.target.value)}
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />;
}
