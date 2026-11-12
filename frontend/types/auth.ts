export type UserRole = "customer" | "admin" | "superadmin";

export interface  User {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: User;
    message: string;
}