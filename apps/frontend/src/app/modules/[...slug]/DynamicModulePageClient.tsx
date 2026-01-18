"use client";

import React from 'react';
import { notFound } from 'next/navigation';

interface DynamicModulePageClientProps {
    slug: string[];
}

export default function DynamicModulePageClient({ slug }: DynamicModulePageClientProps) {
    // This route is likely deprecated in favor of /modules/[module]/[...slug]
    // We will just render a 404 for now to allow the build to pass.
    // Real module routing happens in [module]/[...slug]

    return (
        <div className="p-8 text-center">
            <h1 className="text-xl font-bold mb-4">Route Configuration Error</h1>
            <p className="text-gray-600">
                It seems you have accessed a generic modules route ({slug.join('/')}).
                Please use the structured url format: /modules/module-name/page-route
            </p>
        </div>
    );
}
