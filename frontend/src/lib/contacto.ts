const WHATSAPP_NUMERO = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? "";
const CONTACTO_EMAIL = process.env.NEXT_PUBLIC_CONTACTO_EMAIL ?? "";

const MENSAJE_WHATSAPP = "Hola, necesito soporte técnico de GMP.";
const ASUNTO_EMAIL = "Solicitud de soporte técnico";

export const whatsappUrl = WHATSAPP_NUMERO
  ? `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`
  : null;

export const contactoEmail = CONTACTO_EMAIL || null;

export const mailtoUrl = CONTACTO_EMAIL
  ? `mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent(ASUNTO_EMAIL)}`
  : null;
