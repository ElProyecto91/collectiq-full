export function GOBadge({ size = 'sm' }: { size?: 'xs' | 'sm' }) {
  return (
    <span className={
      'bg-yellow-500 text-black font-black rounded-full ' +
      (size === 'xs' ? 'text-[8px] px-1 py-0.5' : 'text-[9px] px-1.5 py-0.5')
    }>
      GO
    </span>
  );
}

export function GOName({ name }: { name: string }) {
  return (
    <span style={{
      background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }}>
      {name}
    </span>
  );
}