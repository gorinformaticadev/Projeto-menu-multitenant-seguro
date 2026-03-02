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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-muted-foreground" />
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
                        "w-full pl-10 pr-4 py-2 rounded-full border transition-all",
                        "bg-gray-100 dark:bg-secondary/50 border-transparent focus:bg-white dark:focus:bg-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                        "text-sm dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground/50",
                        mobile && "border-none bg-transparent"
                    )}
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Resultados Dropdown */}
            {isOpen && results.length > 0 && (
                <div className={cn(
                    "absolute mt-2 w-full bg-white dark:bg-popover border border-gray-200 dark:border-border rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
                    mobile ? "fixed top-16 left-0 right-0 h-auto max-h-[60vh] mx-4 w-auto" : ""
                )}>
                    <div className="p-2 border-b border-gray-100 dark:border-border flex items-center justify-between bg-gray-50/50 dark:bg-muted/30">
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider ml-2">
                            Resultados ({results.length})
                        </span>
                        <div className="hidden md:flex items-center gap-1.5 mr-2">
                            <span className="text-[10px] text-gray-400 dark:text-muted-foreground flex items-center gap-1">
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
                                            : "text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-muted/50"
                                    )}
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg",
                                        index === selectedIndex ? "bg-primary/20" : "bg-gray-100 dark:bg-muted"
                                    )}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate">{result.label}</span>
                                        <span className="text-[10px] text-gray-400 dark:text-muted-foreground truncate opacity-80">
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
                    <div className="p-2 border-t border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/30 flex justify-center">
                        <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                            Pressione <kbd className="font-sans">Enter</kbd> para selecionar ou <kbd className="font-sans">Esc</kbd> para fechar
                        </p>
                    </div>
                </div>
            )}

            {/* Estado Vazio (quando tem query mas não tem resultados) */}
            {isOpen && query.trim().length >= 2 && results.length === 0 && (
                <div className={cn(
                    "absolute mt-2 w-full bg-white dark:bg-popover border border-gray-200 dark:border-border rounded-xl shadow-2xl z-[100] p-8 text-center",
                    mobile ? "fixed top-16 left-0 right-0 mx-4 w-auto" : ""
                )}>
                    <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-gray-300 dark:text-muted/30" />
                        <p className="text-sm text-gray-500 dark:text-muted-foreground font-medium">
                            Nenhum resultado encontrado para &quot;{query}&quot;
                        </p>
                        <p className="text-xs text-gray-400 dark:text-muted-foreground/60">
                            Tente buscar por termos mais genéricos como &quot;Usuários&quot;, &quot;Configurações&quot; ou o nome de um módulo.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
