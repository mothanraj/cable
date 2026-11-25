import { useEffect, useState } from "react";

import { getUsers } from "../api/users";
import { useAuth } from "../context/AuthContext";

/**
 * Admin-only user dropdown.
 *
 * Defaults to "Collected by" (payments.created_by) and can be reused as
 * "Assigned to" (customers.assigned_user_id) with `label` and
 * `includeInactive`. Values are user ids, not display names, so two users
 * with the same name can still be told apart. Non-admin users remain
 * scoped to their own assigned customers and see no control.
 */
export default function CollectorFilter({
  value = "",
  onChange,
  className = "",
  label = "Collected by",
  allLabel = "All collectors",
  includeInactive = false,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    let cancelled = false;

    getUsers()
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const options = users.filter(
    (item) =>
      includeInactive || item.is_active || item.id === value
  );

  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <select
        className="select"
        value={value || "all"}
        onChange={(event) =>
          onChange(
            event.target.value === "all" ? "" : event.target.value
          )
        }
      >
        <option value="all">{allLabel}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.full_name} ({item.username})
            {!item.is_active ? " (inactive)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
