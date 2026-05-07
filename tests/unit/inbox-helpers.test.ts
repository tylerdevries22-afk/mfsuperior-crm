import { describe, it, expect } from "vitest";
import {
  classifyMessage,
  extractAddress,
  isBounceSender,
} from "@/lib/gmail/inbox-helpers";

describe("extractAddress", () => {
  it("extracts the address from a Display Name <addr@host> form", () => {
    expect(extractAddress('"Sam Cooper" <sam@elite-brands.com>')).toBe(
      "sam@elite-brands.com",
    );
  });
  it("lower-cases the result", () => {
    expect(extractAddress("Sam <Sam@Elite-Brands.COM>")).toBe(
      "sam@elite-brands.com",
    );
  });
  it("handles a bare address with no display name", () => {
    expect(extractAddress("sam@elite-brands.com")).toBe(
      "sam@elite-brands.com",
    );
  });
  it("returns the input lower-cased when no email is found", () => {
    expect(extractAddress("not-an-email")).toBe("not-an-email");
  });
});

describe("isBounceSender", () => {
  it("recognizes Gmail/Google Mailer-Daemon", () => {
    expect(
      isBounceSender("mailer-daemon@googlemail.com", "Delivery Status Notification (Failure)"),
    ).toBe(true);
  });
  it("recognizes generic postmaster addresses", () => {
    expect(isBounceSender("postmaster@example.com", "Undeliverable")).toBe(true);
  });
  it("recognizes ESP bounce subdomains", () => {
    expect(isBounceSender("noreply@bounces.amazonses.com", "")).toBe(true);
    expect(isBounceSender("bounce@bounces.mailgun.com", "")).toBe(true);
  });
  it("recognizes DSN subjects even from non-obvious senders", () => {
    expect(isBounceSender("noreply@example.com", "Mail Delivery Failed")).toBe(true);
    expect(isBounceSender("noreply@example.com", "Returned mail: see transcript for details")).toBe(true);
  });
  it("does NOT flag a normal reply as a bounce", () => {
    expect(
      isBounceSender("sam@elite-brands.com", "Re: Box-truck capacity for Elite Brands"),
    ).toBe(false);
  });
});

describe("classifyMessage", () => {
  const operator = "tylerdevries22@gmail.com";

  it("returns null for messages from the operator (us)", () => {
    expect(
      classifyMessage(
        '"Tyler DeVries" <tylerdevries22@gmail.com>',
        "Box-truck capacity",
        operator,
      ),
    ).toBeNull();
  });

  it("returns 'reply' for a normal third-party message", () => {
    expect(
      classifyMessage(
        '"Sam Cooper" <sam@elite-brands.com>',
        "Re: Box-truck capacity",
        operator,
      ),
    ).toBe("reply");
  });

  it("returns 'bounce' for a Mailer-Daemon DSN", () => {
    expect(
      classifyMessage(
        "mailer-daemon@googlemail.com",
        "Delivery Status Notification (Failure)",
        operator,
      ),
    ).toBe("bounce");
  });

  it("is case-insensitive on the operator address comparison", () => {
    expect(
      classifyMessage("<TylerDeVries22@Gmail.com>", "Re: hello", operator),
    ).toBeNull();
  });
});
