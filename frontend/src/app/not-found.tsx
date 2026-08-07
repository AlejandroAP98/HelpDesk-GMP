import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-gray-900 mb-2">404</h1>
        <p className="text-gray-500 mb-6">Pagina no encontrada</p>
        <Link href="/" className="rounded-xl bg-brandCustom px-5 py-2.5 text-sm font-medium text-white hover:bg-brandCustom/90 transition-all">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
