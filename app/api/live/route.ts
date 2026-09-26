import { gatewaySocketUrl } from "@/lib/api/client";
import { USE_MOCK } from "@/lib/api/config";
import { subscribeAdminLive } from "@/lib/api/live";

export const dynamic = "force-dynamic";

const PING_MS = 25_000;
const encoder = new TextEncoder();

export async function GET(request: Request) {
  // 204 is the one answer that makes EventSource stop retrying.
  if (USE_MOCK) return new Response(null, { status: 204 });

  const brokerURL = await gatewaySocketUrl();
  if (!brokerURL) return new Response(null, { status: 401 });

  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let done = false;
      const write = (chunk: string) => {
        if (!done) controller.enqueue(encoder.encode(chunk));
      };
      const ping = setInterval(() => write(": ping\n\n"), PING_MS);
      const unsubscribe = subscribeAdminLive(brokerURL, {
        onFrame: (body) => write(`data: ${body.replace(/\r?\n/g, " ")}\n\n`),
        onClose: () => {
          if (done) return;
          stop();
          controller.close();
        },
      });
      stop = () => {
        if (done) return;
        done = true;
        clearInterval(ping);
        unsubscribe();
      };
      request.signal.addEventListener("abort", stop);
      write("retry: 3000\n\n");
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
