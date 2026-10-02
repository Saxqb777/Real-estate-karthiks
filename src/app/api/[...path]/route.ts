// Unknown /api/* paths answer with the usual JSON error instead of the HTML 404 page (real routes always win over this catch-all).
import { errorResponse, notFound } from "@/lib/api";

async function missing(req: Request) {
  return errorResponse(notFound(`API endpoint ${new URL(req.url).pathname}`));
}

export { missing as GET, missing as POST, missing as PUT, missing as PATCH, missing as DELETE };
