import { Construction } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { RequirePermission } from "@/components/auth/require-permission";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Permission-gated placeholder page. Renders a polite "access restricted"
 * notice for users without the permission, otherwise a "coming soon" card
 * noting the phase that will build the feature.
 */
export function ComingSoon({
  title,
  subtitle,
  phase,
  permission,
}: {
  title: string;
  subtitle?: string;
  phase: string;
  permission: string;
}) {
  return (
    <RequirePermission permission={permission}>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Construction
            className="text-muted-foreground size-8"
            aria-hidden="true"
          />
          <p className="text-base font-medium">Coming soon</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            This area will be built in{" "}
            <span className="font-medium">{phase}</span>.
          </p>
        </CardContent>
      </Card>
    </RequirePermission>
  );
}
