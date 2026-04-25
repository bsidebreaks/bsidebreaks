'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Poppins } from 'next/font/google';
import { SpotifyMark } from '@/components/icons/spotify-icon';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const accessToken = session && 'accessToken' in session ? session.accessToken : undefined;
  const hasSessionNoSpotify = status === 'authenticated' && !accessToken;

  useEffect(() => {
    if (status === 'authenticated' && accessToken) {
      router.replace('/generate');
    }
  }, [status, accessToken, router]);

  const sessionPending = status === 'loading';
  const redirecting = status === 'authenticated' && !!accessToken;
  const showCenterAuth = status === 'unauthenticated' || (status === 'authenticated' && hasSessionNoSpotify);
  const showWaiting = sessionPending || redirecting;

  return (
    <div className="backgroundClass">
      <Image src="/home/background.jpg" alt="" fill priority className="z-0 object-cover object-center" sizes="100vw" />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/25 to-black/80"
        aria-hidden
      />

      <div className={cn(poppins.className, 'relative z-40')}>
        <div
          className={cn(
            'flex min-h-svh w-full max-w-6xl flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]',
            'mx-auto',
            'gap-0',
          )}
        >
          <div className="space-y-2">
            <p className="text-balance text-[2rem] font-semibold leading-snug tracking-tight text-white">Ditch the broken record</p>
            <p className="text-pretty text-[clamp(2.25rem,9vw,5rem)] font-bold leading-snug text-white">
              Find a city break on the B-Side
            </p>
          </div>

          {showWaiting ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex w-full max-w-[min(100%,20rem)] flex-col items-center gap-4">
                <Spinner className="!size-8 text-white" />
                <p className="text-pretty text-sm text-white/80" role="status">
                  {redirecting ? 'Redirecting…' : 'Checking your session…'}
                </p>
              </div>
            </div>
          ) : showCenterAuth ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex w-full max-w-[min(100%,20rem)] flex-col items-center gap-6">
                <div className="flex w-full flex-col items-stretch gap-2">
                  {hasSessionNoSpotify && (
                    <p className="text-pretty text-sm text-white/70" role="status">
                      This session doesn’t have Spotify access. Sign in with Spotify, or sign out to start over.
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setConnecting(true);
                      void signIn('spotify', { callbackUrl: '/generate' })
                        .then((res) => {
                          if (res?.error) {
                            setAuthError('Could not start Spotify sign-in. Try again.');
                            setConnecting(false);
                          }
                        })
                        .catch(() => {
                          setAuthError('Could not start Spotify sign-in. Try again.');
                          setConnecting(false);
                        });
                    }}
                    disabled={connecting || sessionPending}
                    className={cn(
                      'h-12 w-full rounded-2xl text-[15px] font-semibold',
                      'gap-2.5 border-0 bg-[#1DB954] text-white shadow-md',
                      'shadow-emerald-950/15 hover:bg-[#1ed760] disabled:opacity-60',
                    )}
                  >
                    {connecting || sessionPending ? (
                      <>
                        <Spinner className="!size-5" />
                        {sessionPending ? 'Checking your session…' : 'Connecting…'}
                      </>
                    ) : (
                      <>
                        <SpotifyMark className="size-6 text-white" />
                        Login with Spotify
                      </>
                    )}
                  </Button>
                  {hasSessionNoSpotify && (
                    <button
                      type="button"
                      onClick={() => void signOut({ callbackUrl: '/' })}
                      className="w-full py-1.5 text-center text-sm text-white/70 underline decoration-white/30 underline-offset-4 active:opacity-70"
                    >
                      Sign out
                    </button>
                  )}
                  {authError && (
                    <p className="text-pretty text-sm text-red-200" role="alert">
                      {authError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
