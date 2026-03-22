import type { ElementType } from "react";
import {
  BarChart3,
  Blocks,
  BookOpen,
  Building2,
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  LayoutDashboard,
  Menu,
  Package,
  Rocket,
  Settings,
  Shield,
  Tags,
  User,
  Users,
} from "lucide-react";
import * as LucideIcons from "lucide-react";

const explicitIcons: Record<string, ElementType> = {
  LayoutDashboard,
  Building2,
  Settings,
  User,
  Users,
  FileText,
  Shield,
  HelpCircle,
  Package,
  Home,
  Menu,
  BookOpen,
  Rocket,
  BarChart3,
  FolderKanban,
  Tags,
  Blocks,
};

export function resolveNavigationIcon(iconName?: string): ElementType {
  const lucideIcons = LucideIcons as unknown as Record<string, ElementType>;

  if (!iconName) {
    return Menu;
  }

  return explicitIcons[iconName] || lucideIcons[iconName] || Menu;
}
