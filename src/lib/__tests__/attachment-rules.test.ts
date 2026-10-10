// Proof files (owner, 10/10/2026): what may be uploaded, which record it belongs to, and how it is named and served.
import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  cleanFileName,
  contentDisposition,
  fileKeyFor,
  isStorageKey,
  ownerOf,
  sizeText,
  sniffFile,
  thumbKeyFor,
} from "../attachment-rules";

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("sniffFile — the first bytes decide, never the name or the browser's type", () => {
  it("knows JPEG, PNG, WebP photos and PDFs", () => {
    expect(sniffFile(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("jpeg");
    expect(sniffFile(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("png");
    expect(sniffFile(bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 "))).toBe("webp");
    expect(sniffFile(bytes("%PDF-1.7\n"))).toBe("pdf");
  });

  it("refuses everything else (web pages, SVG, GIF, HEIC, text, empty)", () => {
    expect(sniffFile(bytes("<html><script>"))).toBeNull();
    expect(sniffFile(bytes("<svg xmlns="))).toBeNull();
    expect(sniffFile(bytes("GIF89a"))).toBeNull();
    expect(sniffFile(bytes(0, 0, 0, 0x18, "ftypheic"))).toBeNull();
    expect(sniffFile(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeNull();
    expect(sniffFile(bytes("%PD"))).toBeNull();
    expect(sniffFile(new Uint8Array())).toBeNull();
  });
});

describe("ownerOf — a file belongs to exactly one record", () => {
  it("takes the one record named", () => {
    expect(ownerOf({ paymentId: " pay_1 " })).toEqual({ field: "paymentId", id: "pay_1" });
    expect(ownerOf({ leaseId: "lease_1", expenseId: "" })).toEqual({ field: "leaseId", id: "lease_1" });
    expect(ownerOf({ propertyTaxId: "tax_1", other: "x" })).toEqual({ field: "propertyTaxId", id: "tax_1" });
  });

  it("refuses none or more than one", () => {
    expect(ownerOf({})).toHaveProperty("error");
    expect(ownerOf({ paymentId: "   " })).toHaveProperty("error");
    expect(ownerOf({ paymentId: "p", expenseId: "e" })).toEqual({ error: "A file can belong to only one record" });
  });
});

describe("cleanFileName", () => {
  it("keeps the owner's name with the extension of what the file really is", () => {
    expect(cleanFileName("Screenshot 2026-10-10 at 9.41.png", "png")).toBe("Screenshot 2026-10-10 at 9.41.png");
    expect(cleanFileName("IMG_2041.HEIC", "jpeg")).toBe("IMG_2041.jpg");
    expect(cleanFileName("EB bill", "jpeg")).toBe("EB bill.jpg");
    expect(cleanFileName("statement.pdf", "pdf")).toBe("statement.pdf");
  });

  it("drops folders and control characters, names nameless files, caps the length", () => {
    expect(cleanFileName("C:\\Users\\me\\bill.jpg", "jpeg")).toBe("bill.jpg");
    expect(cleanFileName("../../etc/passwd", "pdf")).toBe("passwd.pdf");
    expect(cleanFileName("bi\u0000ll\n.jpg", "jpeg")).toBe("bill.jpg");
    expect(cleanFileName("", "jpeg")).toBe("photo.jpg");
    expect(cleanFileName(null, "pdf")).toBe("document.pdf");
    expect(cleanFileName("x".repeat(300) + ".jpg", "jpeg")).toHaveLength(120);
  });
});

describe("storage keys", () => {
  it("are made from a random folder, never from what was typed", () => {
    const folder = "3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e";
    expect(fileKeyFor(folder, "pdf")).toBe(`attachments/${folder}/file.pdf`);
    expect(fileKeyFor(folder, "jpeg")).toBe(`attachments/${folder}/file.jpg`);
    expect(thumbKeyFor(folder)).toBe(`attachments/${folder}/thumb.jpg`);
    expect(isStorageKey(fileKeyFor(folder, "webp"))).toBe(true);
    expect(isStorageKey(thumbKeyFor(folder))).toBe(true);
  });

  it("anything else is not a key (no climbing out of the folder)", () => {
    expect(isStorageKey("attachments/../.env")).toBe(false);
    expect(isStorageKey("attachments/abc/../../x/file.pdf")).toBe(false);
    expect(isStorageKey("/etc/passwd")).toBe(false);
    expect(isStorageKey("attachments/3f2b8c1e-4d5a/file.html")).toBe(false);
  });
});

describe("serving a file", () => {
  it("shows it in the browser, or saves it, under its own name", () => {
    expect(contentDisposition("bill.jpg")).toBe(`inline; filename="bill.jpg"; filename*=UTF-8''bill.jpg`);
    expect(contentDisposition("bill.jpg", true)).toMatch(/^attachment; /);
  });

  it("keeps non-English names and can't be broken by quotes", () => {
    expect(contentDisposition("Reçu été.pdf")).toBe(`inline; filename="Re_u _t_.pdf"; filename*=UTF-8''${encodeURIComponent("Reçu été.pdf")}`);
    expect(contentDisposition('a"b\\c.pdf')).toContain(`filename="a_b_c.pdf"`);
  });

  it("sizes read plainly; the upload limit fits a Vercel request", () => {
    expect(sizeText(512)).toBe("1 KB");
    expect(sizeText(350 * 1024)).toBe("350 KB");
    expect(sizeText(3.4 * 1024 * 1024)).toBe("3.4 MB");
    expect(MAX_FILE_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
});
