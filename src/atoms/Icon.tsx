import React, { SVGProps } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  CircleAlert,
  CloudDownload,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  FlaskConical,
  FolderUp,
  Info,
  Keyboard,
  KeyboardOff,
  Link,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Share2,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';

// Preserve existing icon names while rendering paths independent of web fonts.
const symbols: Record<string, LucideIcon> = {
  add: Plus,
  add_2: Plus,
  archive: Archive,
  arrow_drop_down: ChevronDown,
  check: Check,
  close: X,
  cloud_download: CloudDownload,
  collapse_content: Minimize2,
  content_copy: Copy,
  delete: Trash2,
  description: FileText,
  download: Download,
  drive_folder_upload: FolderUp,
  edit: Pencil,
  error: CircleAlert,
  expand_content: Maximize2,
  info: Info,
  keyboard_alt: Keyboard,
  keyboard_off: KeyboardOff,
  link: Link,
  open_in_new: ExternalLink,
  progress_activity: LoaderCircle,
  refresh: RefreshCw,
  save: Save,
  science: FlaskConical,
  search: Search,
  settings: Settings,
  share: Share2,
  side_navigation: PanelLeft,
  sync: RefreshCw,
  system_update_alt: Download,
  update: RefreshCw,
  upload_file: FileUp,
  warning: TriangleAlert,
};

type Props = Omit<SVGProps<SVGSVGElement>, 'children'> & { children: string };

const Icon = ({ children, ...props }: Props) => {
  const name = children.trim();
  const Symbol = symbols[name];
  if (!Symbol) {
    throw new Error(`Unknown icon: ${name}`);
  }

  return (
    <Symbol size="1em" aria-hidden="true" focusable="false" {...props}>
      <title>{name}</title>
    </Symbol>
  );
};

export default Icon;
