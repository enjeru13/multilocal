/** Tecla estilo "keycap": muestra un combo como Alt+V o F9. */
export default function Kbd({ combo, className = "" }: { combo: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {combo.split("+").map((k, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 rounded border border-current/30 bg-black/5 dark:bg-white/10 text-[10px] font-semibold leading-none font-mono min-w-4 text-center"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
