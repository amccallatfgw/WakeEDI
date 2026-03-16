export const Roles = {
    Admin: 1,
    Manager: 2,
    User: 3,
    ReadOnly: 4,
} as const;

export type RoleId = (typeof Roles)[keyof typeof Roles];
