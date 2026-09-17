"use client";

const ICON = "/icon-192.png?v5";

function display(title: string, options: NotificationOptions): void {
  const show = () => {
    try {
      const n = new Notification(title, options);
      const url = (options.data as { url?: string } | undefined)?.url;
      n.onclick = () => {
        try {
          window.focus();
        } catch {
        }
        if (url) window.location.href = url;
        n.close();
      };
    } catch {
    }
  };
  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission()
      .then((perm) => {
        if (perm === "granted") show();
      })
      .catch(() => undefined);
  }
}

export function showTicketNotification(
  title: string,
  body: string,
  tag: string,
  ticketId: string,
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  display(title, {
    body,
    icon: ICON,
    badge: ICON,
    tag,
    data: { url: `/tickets/${ticketId}` },
  });
}
