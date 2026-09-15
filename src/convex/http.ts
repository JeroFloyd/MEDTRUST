import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { handleApiRequest } from "./sources/api";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * SOURCE API SURFACE
 * ---------------------------------------------------------------------------
 * GET /api/health
 * GET /api/sources
 * GET /api/sources/<source_id>/schema
 * GET /api/sources/<source_id>/items?limit=10
 * GET /api/sources/<source_id>/item/<medicine_id>
 *
 * These are the endpoints the mediator calls. Each one is answerable
 * independently (e.g. `curl <site>/api/sources/vendor/schema`), which is what
 * makes the sources real systems rather than views over one shared table.
 */
http.route({
  pathPrefix: "/api/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const result = await handleApiRequest(ctx, url.pathname, url.searchParams, url.toString());
    return new Response(JSON.stringify(result.body, null, 2), {
      status: result.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  }),
});

export default http;
