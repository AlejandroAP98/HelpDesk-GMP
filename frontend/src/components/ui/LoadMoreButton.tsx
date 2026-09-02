"use client";

interface LoadMoreButtonProps {
  onClick: () => void;
  label: string;
}

export function LoadMoreButton({ onClick, label }: LoadMoreButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-center text-sm font-normal text-brand-600 hover:text-brand-700 py-2 transition-colors"
    >
      {label}
    </button>
  );
}
