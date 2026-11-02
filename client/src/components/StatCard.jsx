import { useCountUp } from "../hooks/useCountUp";

export default function StatCard({
  label,
  count,
  format,
  value,
  hint,
  icon: Icon,
  tone = "indigo",
  delay = 0,
}) {
  const animated = useCountUp(count ?? 0);
  const display =
    count === undefined || count === null
      ? value
      : format
        ? format(animated)
        : Math.round(animated);

  return (
    <div
      className={`stat-card stat-card--${tone}`}
      style={{ "--delay": `${delay}ms` }}
    >
      <div className="stat-card-top">
        {Icon && (
          <span className="stat-card-icon" aria-hidden="true">
            <Icon size={17} strokeWidth={2.1} />
          </span>
        )}
        <span className="stat-card-label">{label}</span>
      </div>

      <strong className="stat-card-number">{display}</strong>

      {hint && <small className="stat-card-value">{hint}</small>}
    </div>
  );
}
