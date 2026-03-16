import "./globals.css";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { cookies } from "next/headers";
import { decodeJWT } from "@/lib/auth";

export const metadata = {
    title: "WakeEDI",
    icons: {
        icon: "/favicon.ico",
    },
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = cookies();
    const token = cookieStore.get("auth")?.value ?? null;
    const payload = token ? decodeJWT(token) as Record<string, any> | null : null;

    const isLoggedIn = payload !== null;
    const roleId =
        payload && typeof payload.roleId === "number"
            ? payload.roleId
            : null;

    return (
        <html lang="en">
            <head />
            <body>
                {!isLoggedIn ? (
                    children
                ) : (
                    <div className="relative z-[1] flex flex-col h-screen">
                        <Topbar
                            roleId={roleId}
                            userEmail={payload?.email ?? null}
                        />

                        <div className="flex grow overflow-hidden">
                            {/* Sidebar — desktop only */}
                            <div className="hidden md:flex">
                                <Sidebar roleId={roleId} />
                            </div>

                            <main className="grow overflow-y-auto p-2 md:p-4">
                                {children}
                            </main>
                        </div>
                    </div>
                )}
            </body>
        </html>
    );
}
