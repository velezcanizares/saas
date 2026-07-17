import * as Icons from "@saasfly/ui/icons";

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Icons.Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
