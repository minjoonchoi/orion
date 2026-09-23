import type { ReactNode } from "react";
export function TableToolbar({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="ui-table-toolbar">
      <div className="ui-toolbar-filters">{children}</div>
      {actions && <div className="ui-actions">{actions}</div>}
    </div>
  );
}
