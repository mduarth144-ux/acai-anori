import { AdminAreaGate } from '../../components/AdminAreaGate'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminAreaGate>{children}</AdminAreaGate>
}
