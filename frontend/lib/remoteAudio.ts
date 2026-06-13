/** Resume remote participant playback (browser autoplay policy). */
export function resumeRemoteAudio(): void {
  document.querySelectorAll("audio[data-remote-audio]").forEach((el) => {
    const audio = el as HTMLAudioElement;
    audio.volume = 1;
    void audio.play().catch(() => {});
  });

  document.querySelectorAll("video[data-remote-video]").forEach((el) => {
    const video = el as HTMLVideoElement;
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => {});
  });
}
