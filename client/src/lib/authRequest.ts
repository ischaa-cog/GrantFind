export async function authRequest<T>(
  url: string,
  headers: Record<string, string>,
  onUnauthorized: () => void,
  timeoutMs = 15_000,
): Promise<T | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Account verification timed out. Please try again."));
    }, timeoutMs);
  });
  const request = (async () => {
    const response = await fetch(url, {
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    controller.signal.throwIfAborted();
    if (response.status === 401 || response.status === 403) {
      onUnauthorized();
      return null;
    }
    if (!response.ok) {
      let message = "Unable to verify your account right now. Please try again.";
      try {
        const body = await response.json();
        if (typeof body?.message === "string") message = body.message;
      } catch {
        // Keep a safe message for non-JSON server failures.
      }
      throw new Error(message);
    }
    return await response.json() as T;
  })();
  try {
    return await Promise.race([request, deadline]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Account verification timed out. Please try again.");
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}