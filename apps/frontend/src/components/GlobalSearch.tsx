"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { moduleRegistry } from "@/lib/module-registry";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

// Mapeamento de ícones (similar ao Sidebar)
const iconMap = LucideIcons as unknown as Record<string, React.ElementType>;

interface GlobalSearchProps {
    onClose?: () => void;
    mobile?: boolean;
}

interface SearchResult {
    id: string;
    label: string;
    route: string;
    icon: string;
    source: string; // Módulo ou "Sistema"
}

export function GlobalSearch({ onClose, mobile }: GlobalSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fecha ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                if (onClose) onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    // Atalho de teclado (Cmd/Ctrl + K)
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
                setIsOpen(true);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
                if (onClose) onClose();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Lógica de busca
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        const searchTerm = query.toLowerCase();
        const searchResults: SearchResult[] = [];

        // Busca no Module Registry
        const allItems = moduleRegistry.getGroupedSidebarItems(user?.role);

        // 1. Ungrouped (Core)
        allItems.ungrouped.forEach(item => {
            if (item.label.toLowerCase().includes(searchTerm)) {
                searchResults.push({
                    id: item.id || item.route,
                    label: item.label,
                    route: item.route,
                    icon: item.icon || "Menu",
                    source: "Sistema"
                });
            }
        });

        // 2. Groups (Modules)
        Object.entries(allItems.groups).forEach(([groupName, items]) => {
            const moduleName = moduleRegistry.getModule(groupName)?.name || groupName.charAt(0).toUpperCase() + groupName.slice(1);

            items.forEach(item => {
                if (item.label.toLowerCase().includes(searchTerm)) {
                    searchResults.push({
                        id: item.id || item.route,
                        label: item.label,
                        route: item.route,
                        icon: item.icon || "Menu",
                        source: moduleName
                    });
                }

                // Se houver submenus
                if (item.children) {
                    item.children.forEach(child => {
                        if (child.label.toLowerCase().includes(searchTerm)) {
                            searchResults.push({
                                id: child.id || child.route,
                                label: child.label,
                                route: child.route,
                                icon: child.icon || "Menu",
                                source: `${moduleName} > ${item.label}`
                            });
                        }
                    });
                }
            });
        });

        setResults(searchResults.slice(0, 8)); // Limita a 8 resultados
        setSelectedIndex(0);
    }, [query, user?.role]);

    const handleSelect = (result: SearchResult) => {
        router.push(result.route);
        setIsOpen(false);
        setQuery("");
        if (onClose) onClose();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === "Enter" && results[selectedIndex]) {
            e.preventDefault();
            handleSelect(results[selectedIndex]);
        }
    };

    return (
        <div ref={containerRef} className={cn("relative w-full", mobile ? "flex-1" : "max-w-xl mx-4")}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-skin-text-muted" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                    onFocus={() => setIsOpen(true)}
                    placeholder={mobile ? "Buscar no sistema..." : "Buscar no sistema... (Ctrl+K)"}
                    className={cn(
                        "w-full rounded-full border px-4 py-2 pl-10 pr-4 text-sm transition-all",
                        "border-skin-border/70 bg-skin-background-elevated text-skin-text focus:border-primary/50 focus:bg-skin-surface focus:ring-2 focus:ring-skin-focus-ring/20",
                        "placeholder:text-skin-text-muted",
                        mobile && "border-none bg-transparent"
                    )}
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-skin-text-muted transition-colors hover:text-skin-text"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Resultados Dropdown */}
            {isOpen && results.length > 0 && (
                <div className={cn(
                    "absolute z-[100] mt-2 w-full overflow-hidden rounded-xl border border-skin-border bg-skin-surface shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200",
                    mobile ? "fixed top-16 left-0 right-0 h-auto max-h-[60vh] mx-4 w-auto" : ""
                )}>
                    <div className="flex items-center justify-between border-b border-skin-border bg-skin-background-elevated/50 p-2">
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-skin-text-muted">
                            Resultados ({results.length})
                        </span>
                        <div className="hidden md:flex items-center gap-1.5 mr-2">
                            <span className="flex items-center gap-1 text-[10px] text-skin-text-muted">
                                <Keyboard className="h-3 w-3" /> Navegar
                            </span>
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto py-1">
                        {results.map((result, index) => {
                            const Icon = iconMap[result.icon] || LucideIcons.Menu;
                            return (
                                <div
                                    key={result.id}
                                    onClick={() => handleSelect(result)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                                        index === selectedIndex
                                            ? "bg-primary/10 text-primary"
                                            : "text-skin-text hover:bg-skin-surface-hover"
                                    )}
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg",
                                        index === selectedIndex ? "bg-primary/20" : "bg-skin-background-elevated"
                                    )}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate">{result.label}</span>
                                        <span className="truncate text-[10px] text-skin-text-muted opacity-80">
                                            {result.source}
                                        </span>
                                    </div>
                                    {index === selectedIndex && (
                                        <div className="ml-auto text-[10px] font-mono opacity-50 flex items-center gap-1">
                                            <span>Enter</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-center border-t border-skin-border bg-skin-background-elevated/50 p-2">
                        <p className="text-[10px] text-skin-text-muted">
                            Pressione <kbd className="font-sans">Enter</kbd> para selecionar ou <kbd className="font-sans">Esc</kbd> para fechar
                        </p>
                    </div>
                </div>
            )}

            {/* Estado Vazio (quando tem query mas não tem resultados) */}
            {isOpen && query.trim().length >= 2 && results.length === 0 && (
                <div className={cn(
                    "absolute z-[100] mt-2 w-full rounded-xl border border-skin-border bg-skin-surface p-8 text-center shadow-2xl",
                    mobile ? "fixed top-16 left-0 right-0 mx-4 w-auto" : ""
                )}>
                    <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-skin-text-muted/60" />
                        <p className="text-sm font-medium text-skin-text-muted">
                            Nenhum resultado encontrado para &quot;{query}&quot;
                        </p>
                        <p className="text-xs text-skin-text-muted/80">
                            Tente buscar por termos mais genéricos como &quot;Usuários&quot;, &quot;Configurações&quot; ou o nome de um módulo.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
