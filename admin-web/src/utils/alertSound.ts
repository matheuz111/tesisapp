let context: AudioContext | null = null;

/**
 * Doble pitido corto para avisar de una solicitud nueva. Sin archivos de audio ni librerías.
 * Los navegadores bloquean el sonido hasta que la persona interactúa con la página; en ese caso no suena y no pasa nada.
 */
export function playAlertSound(): void {
  try {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    context = context ?? new AudioCtor();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime;
    [0, 0.22].forEach((offset) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.18);
    });
  } catch {
    // Sin audio disponible: el aviso visual basta.
  }
}
