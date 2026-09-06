import {
  BookOpenIcon,
  BookmarkIcon,
  BriefcaseIcon,
  BugIcon,
  CalendarIcon,
  CircleIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FlagIcon,
  GitPullRequestIcon,
  GraduationCapIcon,
  LightbulbIcon,
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
  PencilIcon,
  PhoneIcon,
  PresentationIcon,
  RepeatIcon,
  SparklesIcon,
  SquareIcon,
  TargetIcon,
  TimerIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export const TYPE_ICONS: Record<string, LucideIcon> = {
  circle: CircleIcon,
  square: SquareIcon,
  sparkles: SparklesIcon,
  bug: BugIcon,
  wrench: WrenchIcon,
  'git-pull-request': GitPullRequestIcon,
  users: UsersIcon,
  repeat: RepeatIcon,
  'book-open': BookOpenIcon,
  'file-text': FileTextIcon,
  pencil: PencilIcon,
  'graduation-cap': GraduationCapIcon,
  'clipboard-check': ClipboardCheckIcon,
  timer: TimerIcon,
  flag: FlagIcon,
  mail: MailIcon,
  phone: PhoneIcon,
  briefcase: BriefcaseIcon,
  calendar: CalendarIcon,
  target: TargetIcon,
  lightbulb: LightbulbIcon,
  bookmark: BookmarkIcon,
  'message-circle': MessageCircleIcon,
  presentation: PresentationIcon,
};

export function TypeIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = TYPE_ICONS[icon] ?? CircleIcon;
  return (
    <Icon
      aria-hidden
      strokeWidth={1.5}
      className={cn('size-3.5 shrink-0', className)}
    />
  );
}
