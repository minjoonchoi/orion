export function Skeleton({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div className="ui-skeleton-group" role="status">
      <span className="sr-only">{label}</span>
      {[1, 2, 3].map((row) => (
        <div key={row} className="ui-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}
