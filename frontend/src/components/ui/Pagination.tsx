interface PaginationProps {
  page: number;
  totalPages?: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, hasMore, onPrev, onNext }: PaginationProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-30 disabled:hover:bg-white transition-all"
      >
        Anterior
      </button>
      <span className="text-sm font-medium text-gray-400 px-2">Pagina {page}</span>
      <button
        onClick={onNext}
        disabled={!hasMore}
        className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-30 disabled:hover:bg-white transition-all"
      >
        Siguiente
      </button>
    </div>
  );
}
