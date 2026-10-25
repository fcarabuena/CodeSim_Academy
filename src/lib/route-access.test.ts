import { describe, expect, it } from "vitest";
import { routeDecision } from "./route-access";

describe("routeDecision", () => {
  const student = { id: "s1", role: "STUDENT" };

  it("sends signed-out visitors to log in", () => {
    expect(routeDecision("/dashboard", null)).toBe("login");
    expect(routeDecision("/teacher", undefined)).toBe("login");
    expect(routeDecision("/profile", {})).toBe("login");
  });

  it("keeps students out of the teacher area only", () => {
    expect(routeDecision("/teacher", student)).toBe("forbidden");
    expect(routeDecision("/teacher/classes/abc/students/xyz", student)).toBe("forbidden");
    expect(routeDecision("/dashboard", student)).toBe("allow");
    expect(routeDecision("/leaderboard", student)).toBe("allow");
    expect(routeDecision("/teachers-lounge", student)).toBe("allow");
  });

  it("lets teachers and admins in", () => {
    expect(routeDecision("/teacher/classes/abc", { id: "t1", role: "TEACHER" })).toBe("allow");
    expect(routeDecision("/teacher", { id: "a1", role: "ADMIN" })).toBe("allow");
  });

  it("keeps the admin area for admins only", () => {
    expect(routeDecision("/admin", student)).toBe("forbidden");
    expect(routeDecision("/admin/users", { id: "t1", role: "TEACHER" })).toBe("forbidden");
    expect(routeDecision("/admin/audit", { id: "a1", role: "ADMIN" })).toBe("allow");
    expect(routeDecision("/administrator-guide", student)).toBe("allow");
    expect(routeDecision("/admin", null)).toBe("login");
  });

  it("treats a missing role as a student", () => {
    expect(routeDecision("/teacher", { id: "x" })).toBe("forbidden");
    expect(routeDecision("/admin", { id: "x" })).toBe("forbidden");
  });
});
