import type { ReactNode } from "react";

type Props = {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

/** Quiet empty / missing / blocked state — Absolute UI + Unslop. */
export function EmptyState({ title, children, action }: Props) {
  return (
    <div className="surface empty-state">
      <p className="empty-state__title">{title}</p>
      {children ? <div className="empty-state__body">{children}</div> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
