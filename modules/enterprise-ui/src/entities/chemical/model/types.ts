// A selectable chemical from the adapter's catalog (GET /api/chemicals).
export interface Chemical {
  name: string;
  category?: string | null;
}
