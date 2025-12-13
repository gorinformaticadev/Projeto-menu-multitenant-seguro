import { useModuleFeatures } from "@/hooks/useModuleFeatures";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useMemo } from "react";

interface ModuleSlotProps {
    position: string;
    className?: string;
}

export function ModuleSlot({ position, className }: ModuleSlotProps) {
    const { features, loading } = useModuleFeatures();

    // Usa useMemo para evitar recalcular slots desnecessariamente
    const slots = useMemo(() => {
        if (loading || !features.slots) return [];
        return features.slots.filter(s => s.position === position);
    }, [features.slots, position, loading]);

    if (loading || slots.length === 0) return null;

    return (
        <div className={`space-y-4 ${className || ''}`}>
            {slots.map((slot, index) => {
                if (slot.type === 'alert-info') {
                    return (
                        <Alert key={index} className="bg-blue-50 border-blue-200">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">Informação do Módulo</AlertTitle>
                            <AlertDescription className="text-blue-700">
                                {slot.content}
                            </AlertDescription>
                        </Alert>
                    );
                }

                if (slot.type === 'text-highlight') {
                    return (
                        <div key={index} className="bg-yellow-100 p-2 rounded text-yellow-800 text-sm font-medium text-center">
                            {slot.content}
                        </div>
                    )
                }

                if (slot.type === 'banner') {
                    return (
                        <div key={index} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-lg shadow-md">
                            <h3 className="font-bold text-lg">{slot.content}</h3>
                        </div>
                    )
                }

                // Default text
                return <div key={index}>{slot.content}</div>;
            })}
        </div>
    );
}
