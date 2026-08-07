interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className = "" }: ErrorMessageProps) {
  return (
    <div className={`rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2 animate-fade-in ${className}`}>
      <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm font-normal text-red-600">{message}</p>
    </div>
  );
}
