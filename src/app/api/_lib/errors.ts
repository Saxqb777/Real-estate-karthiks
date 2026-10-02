// Route-only error helpers ("_lib" is a private folder, never routed).
import { ApiError } from "@/lib/api";

/** An error tied to one input field, so the UI can show it next to that field ({ error, issues: [{field, message}] }). */
export function fieldError(status: number, field: string, message: string) {
  return new ApiError(status, message, [{ field, message }]);
}
