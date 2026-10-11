import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router';
import { ApiError } from '@marchlands/api-client';
import { useToken } from '@/hooks/use-auth';
import { usePlayer } from '@/hooks/use-game';
import { LoginPage } from '@/routes/login/login';
import { CreateLordPage } from '@/routes/create-lord/create-lord';
import { GamePage } from '@/routes/game/game';
import { FullPageMessage } from '@/components/full-page-message/full-page-message';

export function App() {
  const token = useToken();
  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return <LoggedIn />;
}

function LoggedIn() {
  const { t } = useTranslation('game');
  const player = usePlayer();
  if (player.isPending) return <FullPageMessage title={t('loading')} />;
  const noLord = player.error instanceof ApiError && player.error.code === -4;
  if (player.error && !noLord) return <FullPageMessage title={t('loadError')} detail={player.error.message} retry={() => void player.refetch()} />;
  return (
    <Routes>
      <Route path="/create" element={noLord ? <CreateLordPage /> : <Navigate to="/" replace />} />
      <Route path="/cities/:cityId/*" element={noLord ? <Navigate to="/create" replace /> : <GamePage />} />
      <Route path="*" element={noLord ? <Navigate to="/create" replace /> : <Navigate to={`/cities/${player.data!.castles[0]?.id ?? 0}`} replace />} />
    </Routes>
  );
}
