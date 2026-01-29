import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every hour
      r && setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-lg p-4 z-50 flex items-center gap-3 max-w-sm">
      <RefreshCw className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-sm">Update available</p>
        <p className="text-xs text-gray-300">Refresh to get the latest version</p>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-white text-gray-900 py-1.5 px-3 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
      >
        Update
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="p-1 text-gray-400 hover:text-white rounded"
        aria-label="Later"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
