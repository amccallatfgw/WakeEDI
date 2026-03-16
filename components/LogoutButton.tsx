"use client";

type LogoutButtonProps = {
    variant?: "default" | "menu";
};

export default function LogoutButton({ variant = "default" }: LogoutButtonProps) {
    const handleLogout = async (e?: React.MouseEvent) => {
        e?.preventDefault();
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    if (variant === "menu") {
        return (
            <a
                href="#"
                role="menuitem"
                onClick={handleLogout}
                className="block px-3 py-2.5 rounded-lg no-underline text-red-600 transition-colors hover:bg-slate-50"
            >
                Log out
            </a>
        );
    }

    return (
        <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-semibold transition-colors"
        >
            Logout
        </button>
    );
}
