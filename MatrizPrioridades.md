# Matriz de Categorías, Subcategorías y Prioridades Automatizadas

## Sistema de HelpDesk - Soporte e Infraestructura de Redes

Este documento establece las reglas lógicas para la clasificación automática de tickets en el sistema de HelpDesk. El cálculo de la prioridad se realiza cruzando tres variables básicas: **Categoría**, **Subcategoría** y **Elemento de Infraestructura Afectado**.

El objetivo es automatizar el triage para mitigar la subjetividad del cliente, garantizando que los recursos técnicos se enfoquen en los incidentes de mayor impacto en la red.

---

## 1. Glosario de Infraestructura (Nivel de Impacto)

Para entender la matriz, los elementos se clasifican según su impacto en el negocio:

* **Torre:** Nodo principal de telecomunicaciones o transporte. Su caída afecta a zonas enteras o múltiples celdas. (Impacto Crítico).
* **Celda:** Sector de radio/antena de distribución. Su falla afecta a un grupo masivo de clientes en un área específica. (Impacto Alto).
* **Mástil:** Estructura secundaria o nodo repetidor local. Afecta a un segmento reducido o enlaces específicos. (Impacto Medio).
* **Punto de venta (POS):** Estructura terminal o cliente final. El impacto está completamente aislado a un solo servicio. (Impacto Bajo).

---

## 2. Matriz de Asignación de Prioridades

### A. Categoría: SOPORTE

*Enfocada en fallas operativas y degradación del servicio. Reacciona fuertemente según la criticidad del elemento afectado.*

| Subcategoría | Elemento Afectado | Prioridad Calculada | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| Caída total del servicio | Torre | **urgente** | Caída de troncal/nodo core. Interrupción masiva de red. |
| Caída total del servicio | Celda | **urgente** | Sector de distribución fuera de línea. Múltiples clientes afectados. |
| Caída total del servicio | Punto de venta | **alta** | Cliente completamente detenido, pero el impacto está aislado. |
| Lentitud o intermitencia | Torre | **alta** | Degradación en el transporte principal. Afecta la calidad general. |
| Lentitud o intermitencia | Celda | **alta** | Saturación, ruido o interferencia en un sector común. |
| Lentitud o intermitencia | Punto de venta | **media** | El cliente experimenta lentitud o pérdida de paquetes, pero opera. |

### B. Categoría: INSTALACIÓN

*Tareas planificadas, despliegues y altas de servicios. No son urgencias operativas, pero la infraestructura central tiene prioridad de agenda.*

| Subcategoría | Elemento Afectado | Prioridad Calculada | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| Instalación o Cambio de Hardware | Torre | **media** | Montaje/reemplazo en nodo principal. Afecta capacidad futura. |
| Instalación o Cambio de Hardware | Mástil | **media** | Modificación física en repetidor local o nodo secundario. |
| Instalación o Cambio de Hardware | Punto de venta | **baja** | Instalación de CPE/Router o reemplazo menor en cliente final. |
| Cableado estructurado | Punto de venta | **baja** | Despliegue de red LAN interna, canalización o peinado de rack. |
| Configuración de equipos nuevos | Torre | **media** | Comisionamiento y aprovisionamiento de routers/switches core. |
| Configuración de equipos nuevos | Mástil | **media** | Configuración de enlaces backhaul locales o APs secundarios. |
| Configuración de equipos nuevos | Punto de venta | **baja** | Configuración inicial de equipos cliente (CPE, Routers Home, etc). |

### C. Categoría: MANTENIMIENTO

*Tareas preventivas destinadas a mitigar riesgos futuros. Se programan fuera de horas pico y se priorizan según el riesgo del activo.*

| Subcategoría | Elemento Afectado | Prioridad Calculada | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| Actualización de Software | Torre | **media** | Parcheo de firmware/OS en equipos core. Requiere ventana de mantenimiento. |
| Actualización de Software | Celda | **media** | Actualización de firmware en sectores. Afecta temporalmente a un grupo. |
| Actualización de Software | Mástil | **baja** | Actualización de firmware en repetidores redundantes o de bajo impacto. |
| Actualización de Software | Punto de venta | **baja** | Actualización programada en equipos terminales de clientes. |
| Limpieza y Respaldo | Torre | **baja** | Rutina de backup de configuraciones core y limpieza física de racks. |
| Limpieza y Respaldo | Mástil | **baja** | Mantenimiento preventivo físico y lógico en nodos secundarios. |
| Limpieza y Respaldo | Punto de venta | **baja** | Mantenimiento preventivo básico en la infraestructura del cliente. |

---
