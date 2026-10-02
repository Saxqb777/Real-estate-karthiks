// Plain-English fallbacks for zod issues that have no custom message, so the owner never sees zod jargon
// such as "Invalid input: expected string, received number". Field messages set in the schemas still win
// (zod uses a schema's own message before this global map). Imported for its side effect by every schema module.
import { z } from "zod";

const EXPECTED: Record<string, string> = {
  string: "must be text",
  number: "must be a number",
  int: "must be a whole number",
  boolean: "must be true or false",
  date: "must be a date (YYYY-MM-DD or D/M/YYYY)",
  array: "must be a list",
  object: "must be a group of fields",
};

z.config({
  customError: (iss) => {
    switch (iss.code) {
      case "invalid_type":
        // The whole request body (no path) isn't an object, e.g. [] or null was sent.
        if (!iss.path?.length && iss.expected === "object") return "Send the details as a JSON object";
        return EXPECTED[iss.expected] ?? "has the wrong type";
      case "invalid_value":
        return `must be one of ${iss.values.map(String).join(", ")}`;
      case "invalid_format":
        return iss.format === "email" ? "must be a valid email" : iss.format === "url" ? "must be a valid web link" : "has the wrong format";
      case "too_small":
        if (iss.origin === "string") return Number(iss.minimum) <= 1 ? "is required" : `must be at least ${iss.minimum} characters`;
        return undefined;
      case "too_big":
        if (iss.origin === "string") return `must be at most ${iss.maximum} characters`;
        return undefined;
      default:
        return undefined; // keep zod's own message
    }
  },
});

export {};
