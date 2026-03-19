import { useMemo } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useModuleFeatures } from "@/hooks/useModuleFeatures";

interface ModuleSlotProps {
    position: string;
    className?: string;
}

export function ModuleSlot({ position, className }: ModuleSlotProps) {
    const { features, loading } = useModuleFeatures();

    const slots = useMemo(() => {
        if (loading || !features.slots) return [];
        return features.slots.filter((slot) => slot.position === position);
    }, [features.slots, position, loading]);

    if (loading || slots.length === 0) return null;

    return (
        <div className={`space-y-4 ${className || ""}`}>
            {slots.map((slot, index) => {
                if (slot.type === "alert-info") {
                    return (
                        <Alert key={index} className="border-skin-info/30 bg-skin-info/10">
                            <Info className="h-4 w-4 text-skin-info" />
                            <AlertTitle className="text-skin-info">Informacao do modulo</AlertTitle>
                            <AlertDescription className="text-skin-info">
                                {slot.content}
                            </AlertDescription>
                        </Alert>
                    );
                }

                if (slot.type === "text-highlight") {
                    return (
                        <div
                            key={index}
                            className="rounded bg-skin-warning/15 p-2 text-center text-sm font-medium text-skin-warning"
                        >
                            {slot.content}
                        </div>
                    );
                }

                if (slot.type === "banner") {
                    return (
                        <div
                            key={index}
                            className="rounded-lg bg-skin-primary p-4 text-skin-text-inverse shadow-md"
                        >
                            <h3 className="text-lg font-bold">{slot.content}</h3>
                        </div>
                    );
                }

                return <div key={index}>{slot.content}</div>;
            })}
        </div>
    );
}
