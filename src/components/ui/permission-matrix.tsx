"use client";
import { useI18n } from "@/i18n/provider";
import { Checkbox } from "./checkbox";
export type PermissionResource = {
  id: string;
  label: string;
  actions: string[];
};
export type PermissionAction = { id: string; label: string };
export function permissionKey(resource: string, action: string) {
  return JSON.stringify([resource, action]);
}
/** UI selection only. The backend must validate every submitted permission. */
export function PermissionMatrix({
  resources,
  actions,
  value,
  onChange,
  disabled = false,
}: {
  resources: PermissionResource[];
  actions: PermissionAction[];
  value: ReadonlySet<string>;
  onChange: (value: Set<string>) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  function toggle(keys: string[], checked: boolean) {
    const next = new Set(value);
    keys.forEach((key) => {
      if (checked) next.add(key);
      else next.delete(key);
    });
    onChange(next);
  }
  function group(keys: string[], label: string) {
    const count = keys.filter((key) => value.has(key)).length;
    return (
      <Checkbox
        aria-label={t(label)}
        disabled={disabled || keys.length === 0}
        checked={keys.length > 0 && count === keys.length}
        indeterminate={count > 0 && count < keys.length}
        onChange={(e) => toggle(keys, e.target.checked)}
      />
    );
  }
  return (
    <div
      className="ui-table-scroll"
      role="region"
      aria-label={t("권한 매트릭스")}
      tabIndex={0}
    >
      <table className="ui-table ui-permissions">
        <caption>{t("리소스별 허용 작업")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("리소스")}</th>
            <th scope="col">{t("리소스 전체")}</th>
            {actions.map((action) => (
              <th scope="col" key={action.id}>
                <span>{t(action.label)}</span>
                {group(
                  resources
                    .filter((resource) => resource.actions.includes(action.id))
                    .map((resource) => permissionKey(resource.id, action.id)),
                  t(`${t(action.label)} 전체 선택`),
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource.id}>
              <th scope="row">{t(resource.label)}</th>
              <td>
                {group(
                  actions
                    .filter((action) => resource.actions.includes(action.id))
                    .map((action) => permissionKey(resource.id, action.id)),
                  t(`${t(resource.label)} 전체 선택`),
                )}
              </td>
              {actions.map((action) => (
                <td key={action.id}>
                  {resource.actions.includes(action.id) ? (
                    <Checkbox
                      aria-label={`${t(resource.label)} ${t(action.label)}`}
                      checked={value.has(permissionKey(resource.id, action.id))}
                      disabled={disabled}
                      onChange={(e) =>
                        toggle(
                          [permissionKey(resource.id, action.id)],
                          e.target.checked,
                        )
                      }
                    />
                  ) : (
                    <span
                      className="ui-hint"
                      aria-label={t("지원하지 않는 작업")}
                    >
                      —
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
