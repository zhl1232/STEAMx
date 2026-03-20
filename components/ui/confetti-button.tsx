"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface ConfettiButtonProps extends React.ComponentProps<typeof Button> {
    isCompleted?: boolean;
}

export function ConfettiButton({ children, className, isCompleted = false, ...props }: ConfettiButtonProps) {
    return (
        <Button
            className={className}
            variant={isCompleted ? "secondary" : "default"}
            {...props}
        >
            {isCompleted ? <><Check className="mr-2 h-4 w-4" /> 已完成</> : children}
        </Button>
    );
}
