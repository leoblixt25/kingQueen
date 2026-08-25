import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Download, Share } from 'lucide-react';
import MainTitle from '@/components/MainTitle';

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const APP_URL = 'https://sandy-scorekeeper.pages.dev';

export default function InstallPage() {
  const navigate = useNavigate();
  const platform = detectPlatform();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        <div className="text-6xl">📲</div>
        <div className="w-full max-w-2xl mx-auto text-center px-4 mb-4">
          <MainTitle />
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardContent className="p-8 space-y-5">
            {installed ? (
              <>
                <div className="text-4xl">✅</div>
                <h2 className="text-xl font-bold text-ocean">App Installed!</h2>
                <p className="text-foreground/70">
                  Open it from your home screen next time.
                </p>
              </>
            ) : platform === 'android' ? (
              <>
                <h2 className="text-xl font-bold text-ocean">Install the App</h2>
                <p className="text-foreground/70">
                  Tap below to install King &amp; Queen of the Beach directly to your phone.
                </p>
                {deferredPrompt ? (
                  <Button
                    onClick={handleInstall}
                    className="w-full py-6 text-lg font-semibold bg-ocean hover:bg-ocean-dark text-white shadow-beach transition-all duration-300"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Install App
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-foreground/50">
                      Your browser doesn't support one-tap install yet.
                    </p>
                    <div className="bg-sand/20 rounded-xl p-4 space-y-2 text-sm text-foreground/70 text-left">
                      <p className="font-semibold text-foreground">Manual steps:</p>
                      <p>1. Tap the <strong>⋮</strong> menu in your browser</p>
                      <p>2. Tap <strong>Add to Home screen</strong></p>
                      <p>3. Tap <strong>Install</strong></p>
                    </div>
                  </div>
                )}
              </>
            ) : platform === 'ios' ? (
              <>
                <h2 className="text-xl font-bold text-ocean">Install the App</h2>
                <p className="text-foreground/70">
                  Follow these steps to add King &amp; Queen to your home screen:
                </p>
                <div className="bg-sand/20 rounded-xl p-5 space-y-4 text-left">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ocean text-white text-sm font-bold flex items-center justify-center">1</span>
                    <p className="text-sm text-foreground/80 pt-0.5">
                      Open this page in <strong>Safari</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ocean text-white text-sm font-bold flex items-center justify-center">2</span>
                    <p className="text-sm text-foreground/80 pt-0.5">
                      Tap the <strong>Share</strong> button
                      <span className="inline-block ml-1 px-1.5 py-0.5 bg-foreground/10 rounded text-xs font-mono">⬆️</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ocean text-white text-sm font-bold flex items-center justify-center">3</span>
                    <p className="text-sm text-foreground/80 pt-0.5">
                      Scroll down and tap <strong>Add to Home Screen</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ocean text-white text-sm font-bold flex items-center justify-center">4</span>
                    <p className="text-sm text-foreground/80 pt-0.5">
                      Tap <strong>Add</strong> — the app icon appears on your home screen
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-ocean">Install on Your Phone</h2>
                <p className="text-foreground/70">
                  Scan this QR code with your phone camera to open the app, then install it from there.
                </p>
                <div className="bg-white rounded-xl p-4 inline-block shadow-sm border border-sand-dark/10">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(APP_URL)}`}
                    alt="QR code to install app"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                </div>
                <p className="text-xs text-foreground/50 font-mono break-all">{APP_URL}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
