type Entry = { action: string; targetLabel: string; details: unknown };

/** Turns an audit entry into a readable sentence (after the actor's name). */
export function describeAudit(e: Entry): string {
  const d = (e.details ?? {}) as Record<string, unknown>;
  switch (e.action) {
    case "user.role_changed":
      return `changed ${e.targetLabel} from ${String(d.from).toLowerCase()} to ${String(d.to).toLowerCase()}`;
    case "user.disabled":
      return `disabled ${e.targetLabel}`;
    case "user.enabled":
      return `re-enabled ${e.targetLabel}`;
    case "user.deleted":
      return `deleted ${e.targetLabel}${d.classesDeleted ? ` (and ${d.classesDeleted} class${d.classesDeleted === 1 ? "" : "es"})` : ""}`;
    case "class.reassigned":
      return `moved class "${e.targetLabel}" from ${d.from} to ${d.to}`;
    case "class.deleted":
      return `deleted class "${e.targetLabel}" (${d.students ?? 0} students)`;
    case "class.student_removed":
      return `removed ${d.student} from class "${e.targetLabel}"`;
    case "class.code_regenerated":
      return `gave class "${e.targetLabel}" a new join code`;
    default:
      return `${e.action} on ${e.targetLabel}`;
  }
}
