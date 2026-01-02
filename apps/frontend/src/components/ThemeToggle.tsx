"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const updateTheme = async (newTheme: string) => {
        setTheme(newTheme);
        try {
            await api.patch('/users/preferences', { theme: newTheme });
        } catch (error) {
            console.error('Erro ao salvar preferência de tema:', (error as any).response?.data || error);
        }
    };

    return (
        <div className="px-2 py-1">
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border">
                <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 h-7 px-2 ${theme === 'light' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                    onClick={() => updateTheme('light')}
                    title="Claro"
                >
                    <Sun className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 h-7 px-2 ${theme === 'dark' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                    onClick={() => updateTheme('dark')}
                    title="Escuro"
                >
                    <Moon className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 h-7 px-2 ${theme === 'system' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                    onClick={() => updateTheme('system')}
                    title="Sistema"
                >
                    <Monitor className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
