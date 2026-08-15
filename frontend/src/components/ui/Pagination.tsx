interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <div className="flex items-center gap-2 justify-between sm:justify-center">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-xl flex items-center gap-1 border border-gray-200 bg-white hover:bg-gray-50 p-2 text-xs font-medium text-gray-600 disabled:opacity-30 disabled:hover:bg-white transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="m15 18-6-6 6-6"/></svg>
        Anterior
      </button>
      <span className="text-xs font-normal text-gray-500 px-2">
        Página {page} de {totalPages || 1}
      </span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className="rounded-xl flex items-center gap-1 border border-gray-200 bg-white hover:bg-gray-50 p-2 text-xs font-medium text-gray-600 disabled:opacity-30 disabled:hover:bg-white transition-all"
      >
        Siguiente
       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="m9 6 6 6-6 6"/></svg></button>
    </div>
  );
}
