export const metadata = {
  title: 'Chat to Text | AI Speech Transcription | Beleqet',
  description:
    'Convert voice notes and audio to text in Amharic and English. Powered by Faster-Whisper AI — built into Beleqet for interviews, meetings, and job applications.',
};

export default function ChatToTextPage() {
  return (
    <main className="ctt-page">
      <div className="ctt-hero">
        <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Chat to Text
        </div>
        <h1 className="ctt-hero__h">
          Your voice,
          <br />
          <span style={{ color: 'var(--lime)' }}>turned into words.</span>
        </h1>
        <p className="ctt-hero__sub">
          Upload or record audio — get accurate Amharic and English transcription powered by AI.
          Perfect for job interviews, client meetings, and voice notes.
        </p>
        <a
          className="btn btn-lime"
          href="/login?tab=signup&redirect=/chat-to-text/app"
          style={{ marginTop: 8 }}
        >
          Try It Free →
        </a>
      </div>

      <section className="ctt-section">
        <div className="ctt-demo-card">
          <div className="ctt-demo-header">
            <span className="ctt-demo-dot ctt-demo-dot--red" />
            <span className="ctt-demo-dot ctt-demo-dot--yellow" />
            <span className="ctt-demo-dot ctt-demo-dot--green" />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
              beleqetjobs.com/chat-to-text
            </span>
          </div>
          <div className="ctt-demo-body">
            <div className="ctt-waveform" aria-hidden="true">
              {Array.from({ length: 32 }).map((_, i) => (
                <span
                  key={i}
                  className="ctt-waveform-bar"
                  style={{ height: `${16 + Math.sin(i * 0.8) * 14 + Math.random() * 8}px` }}
                />
              ))}
            </div>
            <div className="ctt-transcript">
              <div className="ctt-transcript-line">
                <span className="ctt-ts">00:03</span>
                <span>ሰላም፣ እኔ ስሜ አቤቤ ነው። አሁን ቃለ-መጠይቅ ለማድረግ ዝግጁ ነኝ።</span>
              </div>
              <div className="ctt-transcript-line">
                <span className="ctt-ts">00:09</span>
                <span>Hello, my name is Abebe. I am ready for the interview now.</span>
              </div>
              <div className="ctt-transcript-line ctt-transcript-line--active">
                <span className="ctt-ts">00:14</span>
                <span className="ctt-typing">
                  I have 5 years of experience in software development…
                  <span className="ctt-cursor" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ctt-section ctt-section--cream">
        <div className="sec-eyebrow">Features</div>
        <h2 className="sec-h" style={{ marginBottom: 40 }}>
          AI transcription built for Ethiopia.
        </h2>
        <div className="ctt-features">
          {[
            {
              icon: '🎤',
              title: 'Live Recording',
              body: 'Record directly in the browser. No app download needed.',
            },
            {
              icon: '📁',
              title: 'File Upload',
              body: 'Upload MP3, MP4, WAV, or M4A files up to 25 MB.',
            },
            {
              icon: '🇪🇹',
              title: 'Amharic + English',
              body: 'Bilingual transcription — switches language mid-sentence automatically.',
            },
            {
              icon: '⚡',
              title: 'Fast Processing',
              body: 'Most clips under 5 minutes are transcribed in under 30 seconds.',
            },
            {
              icon: '📋',
              title: 'Copy & Export',
              body: 'Copy the transcript, download as TXT or PDF, or paste directly into your CV.',
            },
            {
              icon: '🔒',
              title: 'Private & Secure',
              body: 'Audio is deleted from servers immediately after transcription.',
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="ctt-feature">
              <span className="ctt-feature__icon">{icon}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="ctt-cta-band">
        <h2>50 free transcriptions per month with Pro.</h2>
        <p>Sign up free — no credit card required.</p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: 24,
          }}
        >
          <a className="btn btn-lime" href="/login?tab=signup">
            Get Started Free
          </a>
          <a className="btn btn-outline-hero" href="/pricing">
            See Pricing
          </a>
        </div>
      </div>
    </main>
  );
}
