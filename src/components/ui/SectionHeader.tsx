interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="pt-2">
      <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">{title}</h2>
      {description && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}
