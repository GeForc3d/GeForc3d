import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ShotSessionProvider } from './ShotSessionContext';
import { AppFrame } from './AppFrame';
import { DiscoverScreen } from '@/features/discover/DiscoverScreen';
import { PoseLibraryScreen } from '@/features/pose-library/PoseLibraryScreen';
import { PoseDetailScreen } from '@/features/pose-detail/PoseDetailScreen';
import { CameraScreen } from '@/features/camera/CameraScreen';
import { SavedScreen } from '@/features/saved/SavedScreen';
import { AssetReportScreen } from '@/features/dev/AssetReportScreen';
import { routes } from './routes';

/**
 * HashRouter rather than BrowserRouter: the same build has to run from a static
 * host, from a file-ish embedded context and from a sandboxed iframe, none of
 * which can be relied on to rewrite unknown paths to index.html. Hash routing
 * still gives real browser history, so Back and Safari's swipe-back behave
 * exactly as they should (§10).
 */
export function App() {
  return (
    <ShotSessionProvider>
      <HashRouter>
        <AppFrame>
          <Routes>
            <Route path={routes.home} element={<DiscoverScreen />} />
            <Route path={routes.poses} element={<PoseLibraryScreen />} />
            <Route path={routes.posePattern} element={<PoseDetailScreen />} />
            <Route path={routes.camera} element={<CameraScreen />} />
            <Route path={routes.saved} element={<SavedScreen />} />
            <Route path={routes.assets} element={<AssetReportScreen />} />
            <Route path="*" element={<Navigate to={routes.home} replace />} />
          </Routes>
        </AppFrame>
      </HashRouter>
    </ShotSessionProvider>
  );
}
