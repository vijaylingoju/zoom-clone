/** Resume every remote peer audio element (browser autoplay policy). */
export function resumeRemoteAudio(): void {
  document.querySelectorAll("audio[data-remote-audio]").forEach((el) => {
    void (el as HTMLAudioElement).play().catch(() => {});
  });
}
