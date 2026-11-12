"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scopeFilter = scopeFilter;
/**
 * Turns (user, permission) into a MongoDB filter fragment that is merged into the query itself.
 *   own    -> { ownerId: <me> }
 *   branch -> { branchId: <my branch> }
 *   all    -> {}
 * Fails CLOSED: if the user somehow lacks the permission, the filter matches nothing.
 */
function scopeFilter(user, permission) {
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
