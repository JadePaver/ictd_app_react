import { ROLE } from "./constants";

export function roleLabelFor(roleId: number): string {
  return roleId === ROLE.OPERATOR ? "Operator" : "Client";
}

/** True when a role change would strip the acting user's own operator
 * access — blocked outright rather than merely confirmed, since there'd be
 * no one left at this screen to undo it. */
export function isSelfDemotion(userId: number, actingUserId: number | null | undefined, nextRoleId: number): boolean {
  return userId === actingUserId && nextRoleId !== ROLE.OPERATOR;
}
