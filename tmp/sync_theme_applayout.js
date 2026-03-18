const fs = require('fs');
const FILE_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\src\\components\\AppLayout.tsx';

function injectThemeSync() {
    let content = fs.readFileSync(FILE_PATH, 'utf8');
    
    if (content.includes('useTheme(')) {
        console.log('AppLayout already supports Theme sync.');
        return;
    }

    // 1. Add import 'useTheme' from 'next-themes'
    const importStr = `import { RouteGuard } from "./RouteGuard";`;
    const newImportStr = `import { RouteGuard } from "./RouteGuard";\nimport { useTheme } from "next-themes";`;
    
    if (content.includes(importStr)) {
        content = content.replace(importStr, newImportStr);
    }

    // 2. Add hook call and useEffect inside AppLayout
    const hookPlaceholder = `export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isInitialized, error } = useModuleRegistry();`;
                          
    const hookReplacement = `export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isInitialized, error } = useModuleRegistry();
  const { setTheme, theme } = useTheme();

  // Sincroniza tema do backend com o next-themes no primeiro load
  useEffect(() => {
    if (user?.preferences?.theme && user.preferences.theme !== theme) {
      setTheme(user.preferences.theme);
    }
  }, [user, theme, setTheme]);`;

    if (content.includes(hookPlaceholder)) {
        content = content.replace(hookPlaceholder, hookReplacement);
    }

    fs.writeFileSync(FILE_PATH, content);
    console.log('AppLayout updated with theme synchronization.');
}

injectThemeSync();
