import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function FullPageMessage({ title, detail, retry }: { title: string; detail?: string; retry?: () => void }) {
  const { t } = useTranslation('full-page-message');
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      {detail && <p className="max-w-md text-sm text-muted-foreground">{detail}</p>}
      {retry && (
        <Button variant="outline" onClick={retry}>
          {t('tryAgain')}
        </Button>
      )}
    </div>
  );
}
