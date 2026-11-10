import type { AdminRole } from "@prisma/client";
export type Permission="dashboard.read"|"players.read"|"players.moderate"|"players.ban"|"reports.manage"|"economy.read"|"economy.adjust"|"organizations.read"|"organizations.manage"|"security.read"|"security.review"|"staff.read"|"staff.appoint"|"owner.settings";
const operational:Permission[]=["dashboard.read","players.read","players.moderate","players.ban","reports.manage","economy.read","economy.adjust","organizations.read","organizations.manage","security.read","security.review","staff.read"];
const matrix:Record<AdminRole,Permission[]>={
 GA:operational,ZGA:operational,
 SENIOR_ADMIN:["dashboard.read","players.read","players.moderate","players.ban","reports.manage","economy.read","organizations.read","organizations.manage","security.read","security.review","staff.read"],
 ADMIN:["dashboard.read","players.read","players.moderate","reports.manage","organizations.read"],
 SENIOR_MODERATOR:["dashboard.read","players.read","players.moderate","reports.manage"],
 MODERATOR:["players.read","players.moderate","reports.manage"],
 JUNIOR_MODERATOR:["players.read","reports.manage"]
};
export function hasPermission(role:AdminRole,permission:Permission){return matrix[role].includes(permission);}
export function canAppointAdmin(isOwner:boolean){return isOwner;}