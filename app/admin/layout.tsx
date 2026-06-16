import Sidebar from '@/components/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* Panggil komponen sidebar khusus Admin */}
      <Sidebar role="admin" />
      
      {/* Area pengisian menu dinamis di sebelah kanan */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}