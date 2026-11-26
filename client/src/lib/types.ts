export * from '../../../shared/types';
import type {
  GmailAccount,
  EmailThread,
  CommitmentItem,
  ScreenerSender,
  ExtractedTask,
  DraftItem,
  AgentRule,
  CustomView,
  AppSettings,
  ShabbosStatus,
  BriefingData,
} from '../../../shared/types';

export interface BootstrapPayload {
  accounts: GmailAccount[];
  threads: EmailThread[];
  commitments: CommitmentItem[];
  screener: ScreenerSender[];
  tasks: ExtractedTask[];
  drafts: DraftItem[];
  rules: AgentRule[];
  customViews: CustomView[];
  settings: AppSettings;
  shabbosStatus: ShabbosStatus;
  briefing?: BriefingData;
}

export interface ThreadDetailPayload {
  thread: EmailThread;
  senderHistory: EmailThread[];
  relatedThreads: EmailThread[];
  tasks: ExtractedTask[];
}
