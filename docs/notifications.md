# HostelSet Notifications

HostelSet notifications are in-app first. All authenticated users can see their own notification history in the dashboard bell, with realtime updates and a 60-second polling fallback.

Browser notifications are optional. The app only asks for permission after the user clicks "Enable Notifications" in the notification drawer. If the browser does not support notifications, the in-app bell continues to work.

Home-screen PWA notifications can use the same notification records later. Native mobile push or Firebase is not part of this phase; Web Push subscription storage and delivery can be layered on top of the `notifications` table without changing existing business workflows.
