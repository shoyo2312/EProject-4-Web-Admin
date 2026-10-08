import "server-only";

import { Client } from "@stomp/stompjs";

const ADMIN_TOPIC = "/topic/admin";

/**
 * Never reconnects on its own: the browser's EventSource reconnect goes back through the
 * middleware, which is what rotates an expired token.
 */
export function subscribeAdminLive(
  brokerURL: string,
  {
    onReady,
    onFrame,
    onClose,
  }: { onReady: () => void; onFrame: (body: string) => void; onClose: () => void },
): () => void {
  let closed = false;
  const client = new Client({
    brokerURL,
    reconnectDelay: 0,
    onConnect: () => {
      client.subscribe(ADMIN_TOPIC, (message) => onFrame(message.body));
      onReady();
    },
    onStompError: () => {
      void client.deactivate();
    },
    onWebSocketClose: () => {
      if (closed) return;
      closed = true;
      onClose();
    },
  });
  client.activate();

  return () => {
    closed = true;
    void client.deactivate();
  };
}
