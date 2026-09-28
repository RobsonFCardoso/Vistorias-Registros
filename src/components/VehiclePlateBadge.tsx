interface VehiclePlateBadgeProps {
  placa: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function VehiclePlateBadge({ placa, size = 'md', className = '' }: VehiclePlateBadgeProps) {
  const formattedPlaca = placa.toUpperCase().trim();

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 min-w-[76px]',
    md: 'text-sm px-2.5 py-1 min-w-[96px]',
    lg: 'text-base sm:text-lg px-4 py-2 min-w-[130px]'
  };

  const headerHeights = {
    sm: 'h-2 text-[7px]',
    md: 'h-3 text-[8px]',
    lg: 'h-4 text-[10px]'
  };

  return (
    <div
      className={`inline-flex flex-col rounded border-2 border-slate-900 bg-white shadow-sm overflow-hidden font-mono font-extrabold tracking-wider ${className}`}
    >
      {/* Mercosul Blue Top Banner */}
      <div className={`bg-blue-700 text-white flex items-center justify-between px-1.5 ${headerHeights[size]}`}>
        <span className="font-sans font-bold uppercase tracking-widest text-[8px]">BRASIL</span>
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 border border-green-600" />
      </div>

      {/* Plate Number */}
      <div className={`flex items-center justify-center text-slate-950 text-center font-bold tracking-widest ${sizeClasses[size]}`}>
        {formattedPlaca || '--- ----'}
      </div>
    </div>
  );
}
