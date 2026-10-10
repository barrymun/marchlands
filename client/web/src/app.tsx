import { Navigate, Route, Routes } from 'react-router';
import { ApiError } from '@marchlands/api-client';
import { useToken } from '@/hooks/use-auth';
import { usePlayer } from '@/hooks/use-game';
import { LoginPage } from '@/routes/login';
import { CreateLordPage } from '@/routes/create-lord';
import { GamePage } from '@/routes/game';
import { FullPageMessage } from '@/components/full-page-message';

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
  const player = usePlayer();
  if (player.isPending) return <FullPageMessage title="Loading your game…" />;
  const noLord = player.error instanceof ApiError && player.error.code === -4;
  if (player.error && !noLord) return <FullPageMessage title="Could not load the game" detail={player.error.message} retry={() => void player.refetch()} />;
  return (
    <Routes>
      <Route path="/create" element={noLord ? <CreateLordPage /> : <Navigate to="/" replace />} />
      <Route path="/cities/:cityId/*" element={noLord ? <Navigate to="/create" replace /> : <GamePage />} />
      <Route
        path="*"
        element={noLord ? <Navigate to="/create" replace /> : <Navigate to={`/cities/${player.data!.castles[0]?.id ?? 0}`} replace />}
      />
    </Routes>
  );
}
