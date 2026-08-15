import Link from "next/link";
import  _404  from "../app/assets/404.webp";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <img src={_404.src} alt="404" width={300} height={300} className="mb-1 mx-auto" />
        <p className="text-gray-800 mb-6 text-3xl font-bold">Ups... la pagina que buscas no existe</p>
        <Link href="/" className="rounded-xl bg-brandCustom px-5 py-2.5 text-sm font-medium text-white hover:bg-brandCustom/90 transition-all">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
