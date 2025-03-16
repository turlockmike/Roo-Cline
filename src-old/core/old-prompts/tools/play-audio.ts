export function getPlayAudioDescription(): string {
  return `## play_audio
Description: Play an audio file using the system's default audio player. This tool supports common audio formats and uses the sound-play package for playback. Supported formats include: .mp3, .wav, .ogg, .aac, .m4a.
Parameters:
- path: (required) The path to the audio file to play
Usage:
<play_audio>
<path>Path to audio file</path>
</play_audio>

Example: Requesting to play a notification sound
<play_audio>
<path>audio/notification.wav</path>
</play_audio>`
}
