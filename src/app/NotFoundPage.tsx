import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'

export function NotFoundPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={Info}
        title="Halaman tidak ditemukan"
        description="Alamat yang Anda buka tidak tersedia. Kembali ke Beranda untuk melanjutkan."
        action={
          <Button asChild>
            <Link to="/">Kembali ke Beranda</Link>
          </Button>
        }
      />
    </PageContainer>
  )
}
