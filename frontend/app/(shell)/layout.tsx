import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-white">
      <TopBar />
      {/* column-reverse on mobile puts the sidebar at the bottom (tab bar);
          row on md+ puts it on the left (icon rail) */}
      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto border-black/10 bg-white md:rounded-tl-xl md:border-l md:border-t">
          {children}
        </main>
      </div>
    </div>
  );
}
