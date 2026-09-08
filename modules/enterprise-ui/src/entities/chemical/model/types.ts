// A selectable chemical from the adapter's catalog (GET /api/chemicals).
// `code` is the numeric wire identifier (1..8; 0 = none).
export interface Chemical {
  code: number;
  name: string;
  category?: string | null;
}
