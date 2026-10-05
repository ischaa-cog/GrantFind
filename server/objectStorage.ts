import { randomUUID } from "crypto";

// Grant images live in a public Supabase Storage bucket. The database keeps
// app-relative paths like "/objects/uploads/<id>", which map to the bucket key
// "uploads/<id>", so existing image links keep working unchanged.
const BUCKET = "grant-images";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for grant image storage.");
  }
  return { url, serviceRoleKey };
}

export class ObjectStorageService {
  // Maps "/objects/<key>" to the public Supabase URL for that object.
  getPublicObjectUrl(objectPath: string): string {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const key = objectPath.slice("/objects/".length);
    if (!key || key.split("/").some((part) => part === "" || part === "." || part === "..")) {
      throw new ObjectNotFoundError();
    }
    const { url } = getSupabaseConfig();
    return `${url}/storage/v1/object/public/${BUCKET}/${key}`;
  }

  // Returns a one-time signed URL the browser can PUT a new image to.
  async getObjectEntityUploadURL(): Promise<string> {
    const { url, serviceRoleKey } = getSupabaseConfig();
    const key = `uploads/${randomUUID()}`;
    const response = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${key}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase signed upload URL request failed with status ${response.status}`);
    }
    const { url: signedPath } = (await response.json()) as { url: string };
    return `${url}/storage/v1${signedPath}`;
  }

  // Converts an uploaded object's URL back to the "/objects/<key>" path stored in the database.
  normalizeObjectEntityPath(rawPath: string): string {
    let pathname: string;
    try {
      pathname = new URL(rawPath).pathname;
    } catch {
      return rawPath;
    }
    const marker = `/storage/v1/object/upload/sign/${BUCKET}/`;
    const index = pathname.indexOf(marker);
    if (index === -1) {
      return rawPath;
    }
    return `/objects/${pathname.slice(index + marker.length)}`;
  }
}
