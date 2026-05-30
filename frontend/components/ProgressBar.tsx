type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="progress-track" aria-label={`Progress ${clamped}%`}>
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
