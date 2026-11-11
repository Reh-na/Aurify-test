import { AuthUser } from "../middleware/auth";

/**
 * Turns (user, permission) into a MongoDB filter fragment that is merged into the query itself.
 *   own    -> { ownerId: <me> }
 *   branch -> { branchId: <my branch> }
 *   all    -> {}
 * Fails CLOSED: if the user somehow lacks the permission, the filter matches nothing.
 */
export function scopeFilter(user: AuthUser, permission: string): Record<string, unknown> {
  const scope = user.permissions.get(permission);
  switch (scope) {
    case "all":
      return {};
    case "branch":
      return { branchId: user.branchId };
    case "own":
      return { ownerId: user.id };
    default:
      return { _id: { $in: [] } };
  }
}
