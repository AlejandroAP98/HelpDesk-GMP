"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";
import { eventoApi, ticketApi, type EventoCalendario, type EventoCalendarioCreate, type EventoCalendarioUpdate, type Ticket } from "@/lib/endpoints";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import CalendarIcon from "@/app/assets/icons/CalendarIcon";

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

function esDiaPasado(date: Date): boolean {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  return date < inicioHoy;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: EventoCalendario;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventoCalendarioCreate | EventoCalendarioUpdate, id?: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  initialData?: EventoCalendario | null;
  initialStart?: Date;
  initialEnd?: Date;
  tickets: Ticket[];
}

function EventModal({ isOpen, onClose, onSave, onDelete, initialData, initialStart, initialEnd, tickets }: EventModalProps) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [recordarEmail, setRecordarEmail] = useState(false);
  const [minutosAntes, setMinutosAntes] = useState(15);
  const [ticketId, setTicketId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitulo(initialData.titulo);
      setDescripcion(initialData.descripcion || "");
      const inicio = new Date(initialData.fecha_inicio);
      const fin = new Date(initialData.fecha_fin);
      setFechaInicio(format(inicio, "yyyy-MM-dd"));
      setHoraInicio(format(inicio, "HH:mm"));
      setFechaFin(format(fin, "yyyy-MM-dd"));
      setHoraFin(format(fin, "HH:mm"));
      setRecordarEmail(initialData.recordar_email);
      setMinutosAntes(initialData.minutos_antes);
      setTicketId(initialData.ticket_id || "");
    } else {
      setTitulo("");
      setDescripcion("");
      setRecordarEmail(false);
      setMinutosAntes(15);
      setTicketId("");
      if (initialStart) {
        setFechaInicio(format(initialStart, "yyyy-MM-dd"));
        setHoraInicio(format(initialStart, "HH:mm"));
      } else {
        const now = new Date();
        setFechaInicio(format(now, "yyyy-MM-dd"));
        setHoraInicio(format(now, "HH:mm"));
      }
      if (initialEnd) {
        setFechaFin(format(initialEnd, "yyyy-MM-dd"));
        setHoraFin(format(initialEnd, "HH:mm"));
      } else {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        setFechaFin(format(now, "yyyy-MM-dd"));
        setHoraFin(format(now, "HH:mm"));
      }
    }
  }, [initialData, initialStart, initialEnd, isOpen]);

  const handleSubmit = async () => {
    if (!titulo.trim()) return;
    if (!fechaInicio || !horaInicio || !fechaFin || !horaFin) return;

    setGuardando(true);
    try {
      const data = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        fecha_inicio: new Date(`${fechaInicio}T${horaInicio}`).toISOString(),
        fecha_fin: new Date(`${fechaFin}T${horaFin}`).toISOString(),
        recordar_email: recordarEmail,
        minutos_antes: minutosAntes,
        ticket_id: ticketId || null,
      };
      await onSave(data, initialData?.id);
      onClose();
    } catch (error) {
      console.error("Error guardando evento:", error);
    } finally {
      setGuardando(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!onDelete) return;
    if (!confirm("¿Eliminar este evento?")) return;
    
    setEliminando(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error("Error eliminando evento:", error);
    } finally {
      setEliminando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center justify-between text-brandCustom">
          {initialData ? "Editar evento" : "Nuevo evento"}
          <CalendarIcon />
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none"
              placeholder="Título del evento"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none resize-none"
              rows={2}
              placeholder="Descripción opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha inicio *</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hora inicio *</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha fin *</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hora fin *</label>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recordar_email"
              checked={recordarEmail}
              onChange={(e) => setRecordarEmail(e.target.checked)}
              className="rounded border-gray-300 text-brandCustom focus:ring-brandCustom"
            />
            <label htmlFor="recordar_email" className="text-sm text-gray-700">
              Notificar por email
            </label>
          </div>

          {recordarEmail && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Recordar antes del evento
              </label>
              <select
                value={minutosAntes}
                onChange={(e) => setMinutosAntes(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none"
              >
                <option value={5}>5 minutos antes</option>
                <option value={15}>15 minutos antes</option>
                <option value={30}>30 minutos antes</option>
                <option value={60}>1 hora antes</option>
                <option value={120}>2 horas antes</option>
                <option value={240}>4 horas antes</option>
                <option value={480}>8 horas antes</option>
                <option value={720}>12 horas antes</option>
                <option value={1440}>1 día antes</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ticket (opcional)</label>
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none"
            >
              <option value="">Sin vincular</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id.split("-")[0].toUpperCase().slice(0, 8)} - {t.titulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <div>
            {initialData && onDelete && (
              <Button 
                variant="secondary" 
                onClick={handleDeleteClick} 
                disabled={eliminando || guardando}
                className="!bg-redCustom hover:!bg-redCustom/80 !text-white"
              >
                {eliminando ? "Eliminando..." : "Eliminar"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={guardando || eliminando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={guardando || eliminando || !titulo.trim()}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomToolbar({ date, view, onNavigate, onView }: any) {
  const label = () => {
    switch (view) {
      case 'month':
        return format(date, 'MMMM yyyy', { locale: es });
      case 'week':
        return `Semana del ${format(date, 'd MMM', { locale: es })}`;
      case 'day':
        return format(date, 'EEEE, d MMMM yyyy', { locale: es });
      case 'agenda':
        return `Agenda - ${format(date, 'MMMM yyyy', { locale: es })}`;
      default:
        return format(date, 'MMMM yyyy', { locale: es });
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onNavigate('TODAY')}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => onNavigate('PREV')}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => onNavigate('NEXT')}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors"
        >
          →
        </button>
      </div>

      <div className="text-sm font-semibold text-gray-800 capitalize">
        {label()}
      </div>

      <div className="flex gap-1">
        {(['month', 'week', 'day', 'agenda'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              view === v
                ? 'bg-brandCustom text-white border-brandCustom'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
            }`}
          >
            {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : v === 'day' ? 'Día' : 'Agenda'}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CalendarioEventos() {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventoCalendario | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');

  const cargarEventos = useCallback(async () => {
    setCargando(true);
    try {
      const eventosData = await eventoApi.listar();
      setEventos(eventosData);
    } catch (error) {
      console.error("Error cargando eventos:", error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarEventos();
  }, [cargarEventos]);

  useEffect(() => {
    if (modalOpen && tickets.length === 0) {
      ticketApi
        .listar({ vista: "activos", size: 100 })
        .then((r) => setTickets(r.items))
        .catch(() => undefined);
    }
  }, [modalOpen, tickets.length]);

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return eventos.map((e) => ({
      id: e.id,
      title: e.titulo,
      start: new Date(e.fecha_inicio),
      end: new Date(e.fecha_fin),
      resource: e,
    }));
  }, [eventos]);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    if (esDiaPasado(start)) return;
    setSelectedEvent(null);
    setSelectedSlot({ start, end });
    setModalOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event.resource);
    setSelectedSlot(null);
    setModalOpen(true);
  };

  const handleSave = async (data: EventoCalendarioCreate | EventoCalendarioUpdate, id?: string) => {
    if (id) {
      await eventoApi.actualizar(id, data);
    } else {
      await eventoApi.crear(data as EventoCalendarioCreate);
    }
    await cargarEventos();
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    try {
      await eventoApi.eliminar(selectedEvent.id);
      await cargarEventos();
      setModalOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error("Error eliminando evento:", error);
    }
  };

  if (cargando) {
    return <LoadingState />;
  }

  return (
    <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-2 sm:p-4">
      <div className="h-[600px]">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          date={currentDate}
          view={currentView}
          onNavigate={(date) => setCurrentDate(date)}
          onView={(view) => setCurrentView(view as 'month' | 'week' | 'day' | 'agenda')}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          className="cursor-pointer text-xs sm:text-base "
          culture="es"
          messages={{
            next: "Sig",
            previous: "Ant",
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
            agenda: "Agenda",
            date: "Fecha",
            time: "Hora",
            event: "Evento",
            allDay: "Todo el día",
            noEventsInRange: "No hay eventos en este rango",
          }}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.resource.recordar_email ? "#508484" : "#007991",
              borderRadius: "6px",
              opacity: 0.9,
              color: "white",
              border: "none",
              fontSize: "10px",
            },
          })}
          dayPropGetter={(date) =>
            esDiaPasado(date) ? { className: "rbc-day-past" } : {}
          }
          components={{
            toolbar: (props) => (
              <CustomToolbar
                {...props}
              />
            ),
          }}
        />
      </div>

      <EventModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedEvent(null); setSelectedSlot(null); }}
        onSave={handleSave}
        onDelete={selectedEvent ? handleDelete : undefined}
        initialData={selectedEvent}
        initialStart={selectedSlot?.start}
        initialEnd={selectedSlot?.end}
        tickets={tickets}
      />
    </div>
  );
}
