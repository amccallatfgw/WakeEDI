import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default function HomePage() {
    const token = cookies().get("auth")?.value;

    if (!token) redirect("/login");

    try {
        jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        redirect("/login");
    }

    return (
        <section className="p-2">
            <div className="flex items-start justify-between mb-6 pb-4 border-b border-fw-border gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-ink mb-1">Dashboard</h1>
                    <p className="text-sm text-ink-2">WakeEDI overview</p>
                </div>
            </div>
            <DashboardClient />
        </section>
    );
}
