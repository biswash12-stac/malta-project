
"use client";

import {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useSyncExternalStore,
} from "react";

export type User = {
  name: string;
  email: string;
  role: "user" | "admin";
  phone?: string;
  address?: string;
};

type Account = User & {
  password: string;
};

type ProfileUpdate = {
  name: string;
  phone: string;
  address: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => boolean;
  register: (
    name: string,
    email: string,
    password: string
  ) => boolean;
  resetPassword: (
    email: string,
    newPassword: string
  ) => boolean;
  updateProfile: (data: ProfileUpdate) => boolean;
  logout: () => void;
};

type AuthSnapshot = {
  user: User | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

const AUTH_KEY = "malta-user";
const ACCOUNTS_KEY = "malta-accounts";

const DEMO_ACCOUNTS: Account[] = [
  {
    name: "Malta Customer",
    email: "demo@malta.com",
    password: "password123",
    role: "user",
    phone: "",
    address: "",
  },
  {
    name: "Malta Admin",
    email: "admin@malta.com",
    password: "admin123",
    role: "admin",
    phone: "",
    address: "",
  },
];

let snapshot: AuthSnapshot = {
  user: null,
  initialized: false,
};

const serverSnapshot: AuthSnapshot = {
  user: null,
  initialized: false,
};

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

function updateSnapshot(user: User | null) {
  snapshot = {
    user,
    initialized: true,
  };

  listeners.forEach((callback) => callback());
}


function getAccounts(): Account[] {
  try {
    const stored = localStorage.getItem(ACCOUNTS_KEY);

    if (!stored) {
      localStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(DEMO_ACCOUNTS)
      );

      return DEMO_ACCOUNTS;
    }

    const accounts = JSON.parse(stored);

    if (!Array.isArray(accounts)) {
      return DEMO_ACCOUNTS;
    }

    return accounts;
  } catch {
    return DEMO_ACCOUNTS;
  }
}

function saveAccounts(accounts: Account[]) {
  localStorage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify(accounts)
  );
}


function initializeAuth() {
  if (snapshot.initialized || typeof window === "undefined") {
    return;
  }

  let savedUser: User | null = null;

  try {
    const storedUser = localStorage.getItem(AUTH_KEY);

    if (storedUser) {
      const parsed = JSON.parse(storedUser);

      if (
        parsed &&
        ["user", "admin"].includes(parsed.role) &&
        typeof parsed.email === "string" &&
        typeof parsed.name === "string"
      ) {
        savedUser = parsed as User;
      } else {
        localStorage.removeItem(AUTH_KEY);
      }
    }

    getAccounts();
  } catch {
    localStorage.removeItem(AUTH_KEY);
  }

  updateSnapshot(savedUser);
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    initializeAuth();
  }, []);

 
  const login = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const accounts = getAccounts();

      const account = accounts.find(
        (item) =>
          item.email.toLowerCase() === normalizedEmail &&
          item.password === password
      );

      if (!account) return false;

      const loggedInUser: User = {
        name: account.name,
        email: account.email,
        role: account.role,
        phone: account.phone ?? "",
        address: account.address ?? "",
      };

      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify(loggedInUser)
      );

      updateSnapshot(loggedInUser);

      return true;
    } catch {
      return false;
    }
  };

 
  const register = (
    name: string,
    email: string,
    password: string
  ) => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password) {
      return false;
    }

    try {
      const accounts = getAccounts();

      const alreadyExists = accounts.some(
        (account) =>
          account.email.toLowerCase() === normalizedEmail
      );

      if (alreadyExists) return false;

      const newAccount: Account = {
        name: normalizedName,
        email: normalizedEmail,
        password,
        role: "user",
        phone: "",
        address: "",
      };

      saveAccounts([...accounts, newAccount]);

      return true;
    } catch {
      return false;
    }
  };

 
  const updateProfile = (data: ProfileUpdate) => {
    if (!auth.user) return false;

    const normalizedName = data.name.trim();

    if (!normalizedName) return false;

    try {
      const accounts = getAccounts();

      const accountIndex = accounts.findIndex(
        (account) =>
          account.email.toLowerCase() ===
          auth.user?.email.toLowerCase()
      );

      if (accountIndex === -1) return false;

      const updatedAccounts = [...accounts];

      updatedAccounts[accountIndex] = {
        ...updatedAccounts[accountIndex],
        name: normalizedName,
        phone: data.phone.trim(),
        address: data.address.trim(),
      };

      const updatedUser: User = {
        ...auth.user,
        name: normalizedName,
        phone: data.phone.trim(),
        address: data.address.trim(),
      };

      saveAccounts(updatedAccounts);

      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify(updatedUser)
      );

      updateSnapshot(updatedUser);

      return true;
    } catch {
      return false;
    }
  };

  
  const resetPassword = (
    email: string,
    newPassword: string
  ) => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const accounts = getAccounts();

      const accountIndex = accounts.findIndex(
        (account) =>
          account.email.toLowerCase() === normalizedEmail &&
          account.role === "user"
      );

      if (accountIndex === -1) return false;

      const updatedAccounts = [...accounts];

      updatedAccounts[accountIndex] = {
        ...updatedAccounts[accountIndex],
        password: newPassword,
      };

      saveAccounts(updatedAccounts);

      return true;
    } catch {
      return false;
    }
  };

  
  const logout = () => {
    try {
      localStorage.removeItem(AUTH_KEY);
      updateSnapshot(null);
    } catch {
      return;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isLoading: !auth.initialized,
        login,
        register,
        resetPassword,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
