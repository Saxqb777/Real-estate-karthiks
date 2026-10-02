// Shared helpers for /api route handlers: JSON responses, error mapping, body/query parsing.
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} not found`);
export const badRequest = (msg: string, details?: unknown) => new ApiError(400, msg, details);
export const conflict = (msg: string) => new ApiError(409, msg);

/** Recursively convert Prisma Decimals to numbers and Dates to ISO strings. */
export function serialize<T>(value: T): unknown {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return (value as unknown as Prisma.Decimal).toNumber();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = serialize(v);
    return out;
  }
  return value;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(serialize(data), { status });
}

/** Convert any thrown error into a clear JSON error response. */
export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ field: i.path.join(".") || "(body)", message: i.message }));
    const summary = issues.map((i) => (i.field === "(body)" ? i.message : `${i.field}: ${i.message}`)).join("; ");
    return NextResponse.json({ error: `Validation failed — ${summary}`, issues }, { status: 400 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2025":
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      case "P2002": {
        const target = (err.meta?.target as string[] | string | undefined) ?? "field";
        return NextResponse.json(
          { error: `A record with this ${Array.isArray(target) ? target.join(" + ") : target} already exists` },
          { status: 409 },
        );
      }
      case "P2003":
        return NextResponse.json(
          { error: "This record is linked to other records (e.g. leases, expenses, payments) and cannot be removed or changed this way" },
          { status: 409 },
        );
    }
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: "Something went wrong on the server" }, { status: 500 });
}

type RouteCtx = { params: Promise<Record<string, string>> };

/** Wrap a route handler so all errors become JSON responses. */
export function handler(fn: (req: Request, ctx: RouteCtx) => Promise<Response>) {
  return async (req: Request, ctx: RouteCtx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parse + validate a JSON body. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(raw);
}

/** Parse + validate URL search params (all values arrive as strings). */
export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return schema.parse(params);
}

/** Read a dynamic route param. */
export async function param(ctx: RouteCtx, name: string): Promise<string> {
  const p = await ctx.params;
  const v = p[name];
  if (!v) throw badRequest(`Missing route parameter: ${name}`);
  return v;
}
